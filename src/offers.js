// Budowanie modelu widoku ofert (to co w Flask robilo app.py: _to_offer_dict,
// _price_to_number, _detect_currency, _price_to_pln) - z surowych wierszy D1
// (snake_case) na obiekty gotowe do render.js (camelCase).

import { EXCHANGE_RATES } from "./config.js";

const CURRENCY_HINTS = [
  { re: /PLN|zł/i, code: "PLN" },
  { re: /EUR|€/i, code: "EUR" },
  { re: /USD|\$/i, code: "USD" },
];

export function priceToNumber(priceText) {
  if (!priceText) return null;
  const digits = String(priceText).replace(/[^\d]/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}

export function detectCurrency(priceText) {
  if (!priceText) return null;
  for (const { re, code } of CURRENCY_HINTS) {
    if (re.test(priceText)) return code;
  }
  return null;
}

function formatPln(n) {
  const rounded = Math.round(n);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} PLN`;
}

export function priceToPln(priceText, priceValue) {
  const currency = detectCurrency(priceText);
  if (!currency || currency === "PLN") return null;
  const rate = EXCHANGE_RATES[currency];
  if (!rate || priceValue === null || priceValue === undefined) return null;
  return formatPln(priceValue * rate);
}

function formatTimestamp(unixSeconds) {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// row: wiersz z tabeli offers (snake_case, jak zwraca D1).
// highlightHours: przez ile godzin oferta/zmiana ceny jest podswietlana.
export function toOfferView(row, highlightHours) {
  const nowSeconds = Date.now() / 1000;
  const highlightWindow = highlightHours * 3600;

  const priceValue = priceToNumber(row.price);
  const isNew = nowSeconds - row.first_seen <= highlightWindow;
  const priceChangedRecently = Boolean(
    row.price_prev && row.price_changed_at && nowSeconds - row.price_changed_at <= highlightWindow
  );

  return {
    url: row.url,
    title: row.title,
    portal: row.portal || row.search_name,
    location: row.location || "",
    year: row.year || "",
    price: row.price || "brak ceny",
    pricePrev: row.price_prev,
    priceValue,
    pricePln: priceToPln(row.price, priceValue),
    firstSeen: formatTimestamp(row.first_seen),
    isNew,
    priceChangedRecently,
  };
}
