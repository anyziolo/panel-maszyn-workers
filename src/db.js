// Warstwa dostepu do bazy D1 - port db.py.

// Cena wygladajaca jak prawdziwa: separator tysiecy albo min. 4 cyfry pod
// rzad. Uzywane do odroznienia PRAWDZIWEJ zmiany ceny od jednorazowej
// KOREKTY starej, blednie odczytanej ceny (patrz updatePrice).
const LOOKS_LIKE_REAL_PRICE_RE = /\d{1,3}(?:[ .,]\d{3})+|\d{4,}/;
function looksLikeRealPrice(priceText) {
  return Boolean(priceText) && LOOKS_LIKE_REAL_PRICE_RE.test(priceText);
}

export async function offerExists(db, url) {
  const row = await db.prepare("SELECT 1 FROM offers WHERE url = ?").bind(url).first();
  return row !== null && row !== undefined;
}

export async function insertOffer(db, o) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO offers
       (url, search_id, search_name, title, price, year, portal, location, hours, normalized_title, first_seen, notified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(
      o.url,
      o.searchId,
      o.searchName,
      o.title,
      o.price || null,
      o.year || null,
      o.portal || null,
      o.location || null,
      o.hours || null,
      o.normalizedTitle || null,
      Date.now() / 1000
    )
    .run();
}

// Szuka juz istniejacej (pod INNYM url) oferty z takim samym znormalizowanym
// tytulem (marka+model) i takimi samymi roboczogodzinami - to samo
// ogloszenie wystawione wiecej niz raz (np. powtorzone przez sprzedawce albo
// zduplikowane na tym samym portalu). Wymaga znanych obu wartosci (bez
// godzin nie da sie tego bezpiecznie rozstrzygnac). Zwraca url oryginalu
// albo null.
export async function findDuplicateOffer(db, normalizedTitle, hours, excludeUrl) {
  if (!normalizedTitle || !hours) return null;
  const row = await db
    .prepare("SELECT url FROM offers WHERE normalized_title = ? AND hours = ? AND url != ? LIMIT 1")
    .bind(normalizedTitle, hours, excludeUrl || "")
    .first();
  return row ? row.url : null;
}

export async function updateYearIfMissing(db, url, year) {
  if (!year) return;
  await db
    .prepare("UPDATE offers SET year = ? WHERE url = ? AND (year IS NULL OR year = '')")
    .bind(year, url)
    .run();
}

export async function updateLocationIfMissing(db, url, location) {
  if (!location) return;
  await db
    .prepare("UPDATE offers SET location = ? WHERE url = ? AND (location IS NULL OR location = '')")
    .bind(location, url)
    .run();
}

export async function updatePrice(db, url, newPrice) {
  if (!newPrice) return;
  const row = await db.prepare("SELECT price FROM offers WHERE url = ?").bind(url).first();
  if (!row) return;
  const oldPrice = row.price;
  if (!oldPrice) {
    await db.prepare("UPDATE offers SET price = ? WHERE url = ?").bind(newPrice, url).run();
    return;
  }
  if (oldPrice === newPrice) return;
  if (!looksLikeRealPrice(oldPrice)) {
    // Korekta blednie odczytanej starej ceny, nie prawdziwa zmiana.
    await db.prepare("UPDATE offers SET price = ? WHERE url = ?").bind(newPrice, url).run();
    return;
  }
  await db
    .prepare("UPDATE offers SET price = ?, price_prev = ?, price_changed_at = ? WHERE url = ?")
    .bind(newPrice, oldPrice, Date.now() / 1000, url)
    .run();
}

export async function markNotified(db, urls) {
  if (!urls.length) return;
  const stmt = db.prepare("UPDATE offers SET notified = 1 WHERE url = ?");
  await db.batch(urls.map((u) => stmt.bind(u)));
}

export async function getUnnotified(db) {
  const { results } = await db.prepare("SELECT * FROM offers WHERE notified = 0 ORDER BY first_seen ASC").all();
  return results;
}

// Sortowanie: normalnie od najnowszej (first_seen), ale jesli ofercie
// ostatnio ZMIENILA SIE CENA (prawdziwa zmiana, nie korekta), a to jest
// swiezsze niz first_seen - taka oferta rowniez wskakuje na gore listy.
const ORDER_BY_RECENT = "ORDER BY max(first_seen, COALESCE(price_changed_at, 0)) DESC";

export async function getRecentOffersForSearchIds(db, searchIds, limit) {
  if (!searchIds.length) return [];
  const placeholders = searchIds.map(() => "?").join(",");
  const query = `SELECT * FROM offers WHERE search_id IN (${placeholders}) ${ORDER_BY_RECENT} LIMIT ?`;
  const { results } = await db.prepare(query).bind(...searchIds, limit).all();
  return results;
}

export async function startRun(db) {
  const res = await db.prepare("INSERT INTO runs (started_at) VALUES (?)").bind(Date.now() / 1000).run();
  return res.meta.last_row_id;
}

export async function finishRun(db, runId, newOffers, error = null) {
  await db
    .prepare("UPDATE runs SET finished_at = ?, new_offers = ?, error = ? WHERE id = ?")
    .bind(Date.now() / 1000, newOffers, error, runId)
    .run();
}

export async function getLastRun(db) {
  return db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1").first();
}

export async function isFirstRun(db) {
  const row = await db.prepare("SELECT COUNT(*) AS c FROM runs").first();
  return row.c === 0;
}

export async function getSetting(db, key, defaultValue = null) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : defaultValue;
}

export async function setSetting(db, key, value) {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key, value)
    .run();
}

export async function isPaused(db) {
  return (await getSetting(db, "paused", "0")) === "1";
}
