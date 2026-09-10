import { priceToNumber, detectCurrency, priceToPln, toOfferView } from "../src/offers.js";

let failed = 0;
function check(desc, actual, expected) {
  const ok = actual === expected;
  console.log(`[${ok ? "OK" : "FAIL"}] ${desc}\n    -> otrzymano: ${JSON.stringify(actual)} (oczekiwano: ${JSON.stringify(expected)})`);
  if (!ok) failed++;
}

check("priceToNumber USD z przecinkami", priceToNumber("$214,900"), 214900);
check("priceToNumber PLN ze spacjami", priceToNumber("146 370 PLN"), 146370);
check("priceToNumber null", priceToNumber(null), null);

check("detectCurrency EUR", detectCurrency("€185,000"), "EUR");
check("detectCurrency USD", detectCurrency("$214,900"), "USD");
check("detectCurrency PLN", detectCurrency("235 000 PLN"), "PLN");

check("priceToPln dla PLN -> brak przelicznika", priceToPln("235 000 PLN", 235000), null);
check("priceToPln dla EUR (185000 * 4.30)", priceToPln("€185,000", 185000), "795 500 PLN");

const nowSec = Date.now() / 1000;
const rowNew = { url: "u1", title: "t", portal: "Mascus", location: "Polska", year: "2020", price: "€100,000", price_prev: null, first_seen: nowSec - 3600, price_changed_at: null };
const viewNew = toOfferView(rowNew, 24);
check("toOfferView: oferta z ostatniej godziny jest 'nowa' (highlight 24h)", viewNew.isNew, true);
check("toOfferView: brak zmiany ceny", viewNew.priceChangedRecently, false);
check("toOfferView: przelicznik PLN obecny", viewNew.pricePln, "430 000 PLN");

const rowOld = { url: "u2", title: "t2", portal: "Truck1", location: "Niemcy", year: "2015", price: "$50,000", price_prev: "$45,000", first_seen: nowSec - 100 * 3600, price_changed_at: nowSec - 3600 };
const viewOld = toOfferView(rowOld, 24);
check("toOfferView: stara oferta nie jest 'nowa'", viewOld.isNew, false);
check("toOfferView: niedawna zmiana ceny wykryta", viewOld.priceChangedRecently, true);
check("toOfferView: pricePrev przekazane", viewOld.pricePrev, "$45,000");

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
