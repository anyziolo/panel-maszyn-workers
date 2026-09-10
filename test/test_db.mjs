// Test integracyjny db.js na prawdziwym SQLite (przez shim D1 - node:sqlite),
// zamiast czystych mockow - sprawdza faktyczne zapytania SQL z db.js.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createD1 } from "./d1_shim.mjs";
import * as db from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

let failed = 0;
function check(desc, cond) {
  console.log(`[${cond ? "OK" : "FAIL"}] ${desc}`);
  if (!cond) failed++;
}

const D1 = createD1(schemaPath);

// --- insertOffer / offerExists ---
check("offerExists=false przed wstawieniem", !(await db.offerExists(D1, "https://x/1")));
await db.insertOffer(D1, {
  url: "https://x/1",
  searchId: "s1",
  searchName: "Szukanie 1",
  title: "Caterpillar M316",
  price: "$214,900",
  year: "2019",
  portal: "MachineryLine",
  location: "USA",
});
check("offerExists=true po wstawieniu", await db.offerExists(D1, "https://x/1"));

// INSERT OR IGNORE - drugie wstawienie tego samego URL nie powinno nadpisac
await db.insertOffer(D1, { url: "https://x/1", searchId: "s1", searchName: "x", title: "INNY TYTUL", price: "1", portal: "x" });
const rowAfterDup = await D1.prepare("SELECT title FROM offers WHERE url = ?").bind("https://x/1").first();
check("INSERT OR IGNORE nie nadpisuje istniejacej oferty", rowAfterDup.title === "Caterpillar M316");

// --- updateYearIfMissing / updateLocationIfMissing ---
await db.insertOffer(D1, { url: "https://x/2", searchId: "s1", searchName: "x", title: "Volvo", price: "1", portal: "x" });
await db.updateYearIfMissing(D1, "https://x/2", "2015");
let row2 = await D1.prepare("SELECT year, location FROM offers WHERE url = ?").bind("https://x/2").first();
check("updateYearIfMissing wypelnia brakujacy rok", row2.year === "2015");
await db.updateYearIfMissing(D1, "https://x/2", "1999");
row2 = await D1.prepare("SELECT year FROM offers WHERE url = ?").bind("https://x/2").first();
check("updateYearIfMissing NIE nadpisuje juz ustawionego roku", row2.year === "2015");

await db.updateLocationIfMissing(D1, "https://x/2", "Polska");
row2 = await D1.prepare("SELECT location FROM offers WHERE url = ?").bind("https://x/2").first();
check("updateLocationIfMissing wypelnia brakujaca lokalizacje", row2.location === "Polska");

// --- updatePrice: korekta vs prawdziwa zmiana ---
// Symulujemy "bledna" starą cene (nie wyglada jak prawdziwa cena - np. "6")
await db.insertOffer(D1, { url: "https://x/3", searchId: "s1", searchName: "x", title: "JCB", price: "6", portal: "x" });
await db.updatePrice(D1, "https://x/3", "235 000 PLN");
let row3 = await D1.prepare("SELECT price, price_prev, price_changed_at FROM offers WHERE url = ?").bind("https://x/3").first();
check("updatePrice: korekta blednej starej ceny aktualizuje cene", row3.price === "235 000 PLN");
check("updatePrice: korekta NIE ustawia price_prev/price_changed_at", row3.price_prev === null && row3.price_changed_at === null);

// Teraz prawdziwa zmiana (stara cena wyglada realistycznie)
await db.updatePrice(D1, "https://x/3", "250 000 PLN");
row3 = await D1.prepare("SELECT price, price_prev, price_changed_at FROM offers WHERE url = ?").bind("https://x/3").first();
check("updatePrice: prawdziwa zmiana aktualizuje cene", row3.price === "250 000 PLN");
check("updatePrice: prawdziwa zmiana zapisuje price_prev", row3.price_prev === "235 000 PLN");
check("updatePrice: prawdziwa zmiana ustawia price_changed_at", typeof row3.price_changed_at === "number" && row3.price_changed_at > 0);

// Ta sama cena - brak zmian
const changedAtBefore = row3.price_changed_at;
await db.updatePrice(D1, "https://x/3", "250 000 PLN");
row3 = await D1.prepare("SELECT price_changed_at FROM offers WHERE url = ?").bind("https://x/3").first();
check("updatePrice: identyczna cena nie zmienia price_changed_at", row3.price_changed_at === changedAtBefore);

// --- markNotified / getUnnotified ---
const unnotifiedBefore = await db.getUnnotified(D1);
check("getUnnotified zawiera nowo wstawione oferty", unnotifiedBefore.some((r) => r.url === "https://x/1"));
await db.markNotified(D1, ["https://x/1", "https://x/2"]);
const unnotifiedAfter = await db.getUnnotified(D1);
check("markNotified oznacza podane URL jako powiadomione", !unnotifiedAfter.some((r) => r.url === "https://x/1" || r.url === "https://x/2"));
check("getUnnotified wciaz zawiera nieoznaczone", unnotifiedAfter.some((r) => r.url === "https://x/3"));

// --- getRecentOffersForSearchIds ---
const recent = await db.getRecentOffersForSearchIds(D1, ["s1"], 10);
check("getRecentOffersForSearchIds zwraca wszystkie 3 oferty z s1", recent.length === 3);
check("getRecentOffersForSearchIds: pusta lista searchIds -> []", (await db.getRecentOffersForSearchIds(D1, [], 10)).length === 0);

// --- runs / startRun / finishRun / getLastRun / isFirstRun ---
check("isFirstRun=true przed pierwszym przebiegiem", await db.isFirstRun(D1));
const runId = await db.startRun(D1);
check("startRun zwraca id", typeof runId === "number" || typeof runId === "bigint");
await db.finishRun(D1, runId, 5, null);
const lastRun = await db.getLastRun(D1);
check("getLastRun zwraca ostatni przebieg z poprawna liczba nowych ofert", lastRun.new_offers === 5);
check("isFirstRun=false po przebiegu", !(await db.isFirstRun(D1)));

// --- settings / isPaused ---
check("isPaused=false na starcie", !(await db.isPaused(D1)));
await db.setSetting(D1, "paused", "1");
check("isPaused=true po ustawieniu", await db.isPaused(D1));
await db.setSetting(D1, "paused", "1"); // ON CONFLICT DO UPDATE - nie powinno wybuchnac
check("setSetting: ponowny zapis tego samego klucza (upsert) dziala", await db.getSetting(D1, "paused") === "1");
await db.setSetting(D1, "paused", "0");
check("isPaused=false po wznowieniu", !(await db.isPaused(D1)));
check("getSetting z wartoscia domyslna dla nieistniejacego klucza", (await db.getSetting(D1, "brak-takiego-klucza", "domyslna")) === "domyslna");

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
