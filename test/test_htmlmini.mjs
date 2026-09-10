import { parseHtml, getText, findAllAnchors, countMatchingLinks } from "../src/htmlmini.js";

const html = `
<ul class="results-list">
  <li class="offer-item">
    <div class="card">
      <div class="card-media"><img src="x.jpg" alt="zdjecie"></div>
      <div class="card-body">
        <a href="/offer/cat-966f">Caterpillar 966F wheel loader</a>
        <div class="specs">
          <span class="year">2018</span>
          <span class="hours">3200 h</span>
        </div>
        <div class="price-row">$19,740</div>
        <div class="location-row">China</div>
      </div>
    </div>
  </li>
  <li class="offer-item">
    <div class="card">
      <div class="card-body">
        <a href="/offer/volvo-l90g">Volvo L90G wheel loader</a>
        <div class="specs"><span class="year">2013</span></div>
        <div class="price-row">$35,500</div>
        <div class="location-row">USA, Illinois</div>
      </div>
    </div>
  </li>
</ul>
`;

const root = parseHtml(html);
const anchors = findAllAnchors(root);
console.log("Liczba linkow:", anchors.length);
if (anchors.length !== 2) throw new Error("FAIL: powinno byc 2 linki");

const catAnchor = anchors.find((a) => a.attrs.href.includes("cat-966f"));
const volvoAnchor = anchors.find((a) => a.attrs.href.includes("volvo-l90g"));

console.log("Tekst linku CAT:", JSON.stringify(getText(catAnchor)));
if (getText(catAnchor) !== "Caterpillar 966F wheel loader") throw new Error("FAIL: tekst linku CAT");

// tekst rodzica (card-body) powinien zawierac tytul + specyfikacje + cene + lokalizacje
const cardBody = catAnchor.parent;
console.log("Tekst card-body (CAT):", JSON.stringify(getText(cardBody)));
if (!getText(cardBody).includes("China")) throw new Error("FAIL: brak China w tekscie karty");

const urlPattern = /\/offer\/[^"'#\s]+/;
console.log("Liczba linkow w <li> CAT:", countMatchingLinks(catAnchor.parent.parent, urlPattern));
if (countMatchingLinks(catAnchor.parent.parent, urlPattern) !== 1) {
  throw new Error("FAIL: <li> CAT powinien miec 1 link");
}
console.log("Liczba linkow w <ul> (obie karty):", countMatchingLinks(root, urlPattern));
if (countMatchingLinks(root, urlPattern) !== 2) {
  throw new Error("FAIL: <ul> powinien miec 2 linki (granica miedzy kartami)");
}

console.log("\nWSZYSTKO OK - mini-parser HTML dziala poprawnie.");
