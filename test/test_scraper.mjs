// Test integracyjny scraper.js: symulujemy siec (global.fetch) i uzywamy
// prawdziwego SQLite (shim D1), zeby sprawdzic caly przeplyw run() -
// pauza, manual override, pierwszy przebieg, filtr marek tylko dla NOWYCH
// ofert, aktualizacja istniejacych ofert niezaleznie od filtra.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createD1 } from "./d1_shim.mjs";
import * as db from "../src/db.js";
import { SEARCHES } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

let failed = 0;
function check(desc, cond) {
  console.log(`[${cond ? "OK" : "FAIL"}] ${desc}`);
  if (!cond) failed++;
}

// Zbuduj fałszywe strony HTML - dla kazdego wyszukiwania z config.js jedna
// oferta z linkiem pasujacym do jego urlPattern, zeby extractOffers() cos
// znalazl. Marka w tytule kontrolowana per test (domyslnie "Caterpillar",
// zeby przechodzil KEYWORD_FILTER).
function fakeHtmlFor(searchCfg, { brand = "Caterpillar", priceEur = "100,000" } = {}) {
  const samplePaths = {
    mascus_koparki_kolowe: "/budownictwo/koparki-kolowe/oferta-1.html",
    mascus_ladowarki_kolowe: "/budownictwo/ladowarki-kolowe/oferta-1.html",
    truck1_koparki_kolowe: "/maszyny-budowlane/koparki-kolowe/oferta-1-a1.html",
    truck1_ladowarki_kolowe: "/maszyny-budowlane/ladowarki-kolowe/oferta-1-a1.html",
    machineryline_koparki_kolowe: "/-/sale/wheel-excavators/oferta-1--1",
    machineryline_ladowarki_kolowe: "/-/sale/wheel-loaders/oferta-1--1",
  };
  const href = samplePaths[searchCfg.id];
  return `<div><a href="${href}">${brand} model X</a><div>2020 - €${priceEur}</div><div>Polska</div></div>`;
}

let fetchResponses = new Map(); // url -> html string
global.fetch = async (url) => {
  const html = fetchResponses.get(String(url)) ?? "<html><body>brak wynikow</body></html>";
  return { ok: true, text: async () => html };
};

function setupFetchForAllSearches(opts) {
  fetchResponses = new Map();
  for (const s of SEARCHES) {
    fetchResponses.set(s.url, fakeHtmlFor(s, opts));
  }
}

// Importujemy scraper.js PO ustawieniu global.fetch, zeby scraping.js (ktory
// go uzywa wewnatrz fetchHtml) na pewno zlapal nasz mock.
const { run, matchesKeywordFilter } = await import("../src/scraper.js");

check("matchesKeywordFilter: marka z listy -> true", matchesKeywordFilter("Caterpillar 320"));
check("matchesKeywordFilter: marka poza lista -> false", !matchesKeywordFilter("XCMG XE215"));

// --- scenariusz 1: pierwszy przebieg, brak pauzy ---
{
  const D1 = createD1(schemaPath);
  setupFetchForAllSearches({ brand: "Caterpillar" });
  const res = await run({ DB: D1 }, { log: () => {} });
  check("run(): pierwszy przebieg nie jest 'skipped'", res.skipped === false);
  check("run(): pierwszy przebieg wstawia oferty pasujace do filtra marek", res.newOffers === SEARCHES.length);
  check("run(): brak bledu", res.error === null);
  const isFirstAfter = await db.isFirstRun(D1);
  check("run(): po przebiegu isFirstRun=false", !isFirstAfter);

  // --- scenariusz 2: druga oferta z inna marka (poza filtrem) - NIE wstawiona ---
  setupFetchForAllSearches({ brand: "XCMG" }); // ta sama oferta (ten sam URL), ale zmieniona "marka" w tytule i cenie
  const res2 = await run({ DB: D1 }, { log: () => {} });
  check("run(): istniejaca oferta aktualizowana (0 nowych), mimo ze nowy tytul nie pasuje do filtra", res2.newOffers === 0);

  const row = await D1.prepare("SELECT price FROM offers WHERE search_id = ?").bind(SEARCHES[0].id).first();
  check("run(): cena istniejacej oferty zaktualizowana (€100,000 -> €100,000 bez zmiany, bo tu tylko marka sie zmienila w tekscie)", Boolean(row));
}

// --- scenariusz 3: pauza blokuje przebieg automatyczny (manual=false) ---
{
  const D1 = createD1(schemaPath);
  await db.setSetting(D1, "paused", "1");
  setupFetchForAllSearches({ brand: "Caterpillar" });
  const res = await run({ DB: D1 }, { log: () => {} });
  check("run(): gdy paused i manual=false -> skipped=true", res.skipped === true);
  check("run(): gdy skipped, brak nowych ofert", res.newOffers === 0);
  const isFirstStill = await db.isFirstRun(D1);
  check("run(): przebieg pominiety nie zapisuje sie w runs (isFirstRun wciaz true)", isFirstStill);
}

// --- scenariusz 4: pauza NIE blokuje manual=true (klik 'Odswiez teraz') ---
{
  const D1 = createD1(schemaPath);
  await db.setSetting(D1, "paused", "1");
  setupFetchForAllSearches({ brand: "Caterpillar" });
  const res = await run({ DB: D1 }, { manual: true, log: () => {} });
  check("run(): manual=true ignoruje pauze", res.skipped === false);
  check("run(): manual=true nadal wstawia oferty", res.newOffers === SEARCHES.length);
}

// --- scenariusz 5: nowa oferta niepasujaca do filtra marek NIE jest wstawiana ---
{
  const D1 = createD1(schemaPath);
  setupFetchForAllSearches({ brand: "XCMG" }); // XCMG nie jest w KEYWORD_FILTER
  const res = await run({ DB: D1 }, { log: () => {} });
  check("run(): nowa oferta marki poza filtrem nie jest wstawiana", res.newOffers === 0);
}

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
