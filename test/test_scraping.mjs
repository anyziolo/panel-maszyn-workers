import { extractOffers, findPriceNear, findLocationNear } from "../src/scraping.js";
import { parseHtml, findAllAnchors } from "../src/htmlmini.js";

let failed = 0;
function check(desc, actual, expected) {
  const ok = actual === expected;
  console.log(`[${ok ? "OK" : "FAIL"}] ${desc}\n    -> otrzymano: ${JSON.stringify(actual)} (oczekiwano: ${JSON.stringify(expected)})`);
  if (!ok) failed++;
}

function priceOf(html) {
  const root = parseHtml(html);
  const a = findAllAnchors(root)[0];
  return findPriceNear(a);
}

// --- ceny: waluta przed/po, netto, pulapki modelu/krotkich liczb ---
check(
  "MachineryLine: $ przed liczba (M316)",
  priceOf('<div><a href="/x">Caterpillar M316</a><div>2019 - $214,900</div></div>'),
  "$214,900"
);
check(
  "EUR przed liczba",
  priceOf('<div><a href="/x">Volvo</a><div>€185,000</div></div>'),
  "€185,000"
);
check(
  "Mascus-style: liczba przed PLN",
  priceOf('<div><a href="/x">JCB</a><div>235 000 PLN</div></div>'),
  "235 000 PLN"
);
check(
  "Pulapka: model M316 - nie powinno zlapac '316' jako ceny",
  priceOf('<div><a href="/x">Caterpillar M316</a><div>Ocena: 4.8 $ (nie cena)</div></div>'),
  null
);
check(
  "Pulapka: model liczba przyklejona do prawdziwej ceny (PW148 146 370 PLN)",
  priceOf('<div><a href="/x">Komatsu PW148</a><div>146 370 PLN brutto</div></div>'),
  "146 370 PLN"
);
check(
  "Netto po brutto - ma wybrac netto",
  priceOf('<div><a href="/x">JCB JS130W</a><div>146 370 PLN brutto (119 000 PLN netto)</div></div>'),
  "119 000 PLN"
);
check(
  "Netto przed brutto - ma wybrac netto",
  priceOf('<div><a href="/x">Volvo EW160</a><div>119 000 PLN netto / 146 370 PLN brutto</div></div>'),
  "119 000 PLN"
);

// --- lokalizacja / wykluczanie Chin, bez przeciekania miedzy kartami ---
const html = `
<ul class="results-list">
  <li class="offer-item"><div class="card"><div class="card-body">
    <a href="/offer/cat-966f">Caterpillar 966F wheel loader</a>
    <div class="specs"><span class="year">2018</span></div>
    <div class="price-row">$19,740</div>
    <div class="location-row">China</div>
  </div></div></li>
  <li class="offer-item"><div class="card"><div class="card-body">
    <a href="/offer/volvo-l90g">Volvo L90G wheel loader</a>
    <div class="specs"><span class="year">2013</span></div>
    <div class="price-row">$35,500</div>
    <div class="location-row">USA, Illinois</div>
  </div></div></li>
  <li class="offer-item"><div class="card"><div class="card-body">
    <a href="/offer/liebherr-a900">Liebherr A900 wheel excavator</a>
    <div class="specs"><span class="year">2004</span></div>
    <div class="price-row">53,310 €</div>
    <div class="location-row">Poland</div>
  </div></div></li>
  <li class="offer-item"><div class="card"><div class="card-body">
    <a href="/offer/xcmg-215">XCMG XE215 wheel excavator</a>
    <div class="specs"><span class="year">2021</span></div>
    <div class="price-row">61,900 €</div>
    <div class="location-row">Poland</div>
  </div></div></li>
</ul>`;

const searchCfg = {
  id: "test",
  urlPattern: /\/offer\/[^"'#\s]+/,
  base: "https://example.com",
};

const { offers } = extractOffers(html, searchCfg, "https://example.com");
const byTitle = {};
for (const o of offers) byTitle[o.title] = o;

check("Maszyna z Chin jest wykluczona calkowicie", byTitle["Caterpillar 966F wheel loader"] === undefined, true);
check("Kraj dla Volvo (USA)", byTitle["Volvo L90G wheel loader"]?.location, "USA");
check("Kraj dla Liebherr (Polska)", byTitle["Liebherr A900 wheel excavator"]?.location, "Polska");
check(
  "Marka chinska (XCMG) w Polsce NIE jest wykluczona (liczy sie lokalizacja, nie marka)",
  byTitle["XCMG XE215 wheel excavator"] !== undefined,
  true
);
check("Kraj dla XCMG w Polsce", byTitle["XCMG XE215 wheel excavator"]?.location, "Polska");

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
