// Logika pobierania i parsowania stron z ofertami - port scraping.py.
// Te same zasady co w wersji Python:
// - ogloszenie identyfikujemy po adresie URL (nie po klasach CSS),
// - cena: szukamy najblizszego fragmentu tekstu w poblizu linku pasujacego
//   do wzorca "liczba + PLN/zl/EUR" (lub odwrotnie: "$ + liczba"),
//   preferujac cene NETTO jesli da sie ja rozpoznac,
// - lokalizacja/kraj: szukamy w poblizu, ale z ostrym zabezpieczeniem przed
//   "przeciekaniem" tekstu z sasiedniej karty oferty na liscie,
// - next page: rel=next / aria-label / tekst linku.

import { parseHtml, getText, findAllAnchors, findFirstImg, countMatchingLinks } from "./htmlmini.js";
import { USER_AGENT, REQUEST_TIMEOUT_MS, EXCLUDE_LOCATION_KEYWORDS } from "./config.js";

const CURRENCY_RE_SRC = "(?:PLN|zł|EUR|€|USD|\\$)";
const PRICE_NUMBER_RE_SRC = "(?<![A-Za-z0-9])(?:\\d{1,3}(?:[ .,]\\d{3})+|\\d{4,})";

export const PRICE_AFTER_RE = new RegExp(`(${PRICE_NUMBER_RE_SRC})\\s?(${CURRENCY_RE_SRC})`, "i");
export const PRICE_BEFORE_RE = new RegExp(`(${CURRENCY_RE_SRC})\\s?(${PRICE_NUMBER_RE_SRC})`, "i");

const NET_LABEL_RE = /netto|\bnett\b|\bnet\b/i;

const YEAR_RE = /\b(19[5-9]\d|20[0-3]\d)\b/;
const YEAR_RE_G = /\b(19[5-9]\d|20[0-3]\d)\b/g;

// Roboczogodziny - "3 200 h", "3200 mth", "12,345 hrs", "4500 godz." itd.
// Wymagamy jednostki od razu po liczbie, zeby nie zlapac np. samej ceny
// albo roku. "\b" na koniec chroni przed np. "80 hp" (nie zlapie "h").
const HOURS_NUMBER_RE_SRC = "(?<![A-Za-z0-9])(?:\\d{1,3}(?:[ .,]\\d{3})+|\\d{1,6})";
const HOURS_UNIT_RE_SRC = "(?:mth|mtg|godz\\.?|hrs?|hours?|h)";
const HOURS_RE = new RegExp(`(${HOURS_NUMBER_RE_SRC})\\s?(${HOURS_UNIT_RE_SRC})\\b`, "i");

const NEXT_PAGE_HINTS = ["następna", "nastepna", "next", "dalej", "»", "›"];

export function findHoursNear(tag) {
  let node = tag;
  for (let i = 0; i < 5 && node; i++) {
    const text = getText(node);
    const m = HOURS_RE.exec(text);
    if (m) return m[1].replace(/[ .,]/g, "");
    node = node.parent;
  }
  return null;
}

// Znormalizowany tytul (marka+model, bez roku/ceny/interpunkcji/diakrytykow)
// - uzywany do wykrywania duplikatow (to samo ogloszenie wystawione kilka
// razy, np. na kilku portalach albo powtorzone przez sprzedawce).
export function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findYearInText(text) {
  if (!text) return null;
  const m = YEAR_RE.exec(text);
  return m ? m[1] : null;
}

// Znajduje wszystkie dopasowania ceny (AFTER + BEFORE) w tekście, z pozycjami,
// żeby móc sprawdzić kontekst wokół każdego (etykieta "netto"/"brutto").
function findAllPriceMatches(text) {
  const matches = [];
  for (const re of [PRICE_AFTER_RE, PRICE_BEFORE_RE]) {
    const g = new RegExp(re.source, "gi");
    let m;
    while ((m = g.exec(text)) !== null) {
      matches.push({ text: m[0].trim(), start: m.index, end: m.index + m[0].length });
    }
  }
  return matches;
}

export function findPriceNear(tag) {
  let node = tag;
  for (let i = 0; i < 5 && node; i++) {
    const text = getText(node);
    const candidates = findAllPriceMatches(text);
    if (candidates.length) {
      for (const c of candidates) {
        const window = text.slice(Math.max(0, c.start - 20), c.end + 20);
        if (NET_LABEL_RE.test(window)) return c.text;
      }
      return candidates[0].text;
    }
    node = node.parent;
  }
  return null;
}

export function findYearNear(tag, priceText) {
  let node = tag;
  for (let i = 0; i < 5 && node; i++) {
    const text = getText(node);
    let m;
    const g = new RegExp(YEAR_RE_G.source, "g");
    while ((m = g.exec(text)) !== null) {
      const candidate = m[1];
      if (priceText && priceText.includes(candidate)) continue;
      return candidate;
    }
    node = node.parent;
  }
  return null;
}

// Generator (tablica) tekstu w poblizu ogloszenia - tag + rodzice, ale
// PRZERYWA gdy trafi na wezel zawierajacy wiecej niz 1 link-oferte (czyli
// wyszlismy poza pojedyncza karte). Uzywane przez lokalizacje/Chiny, zeby
// nie "przeciekac" do sasiednich ofert na liscie.
function nearbyOfferTextLevels(tag, pattern, maxLevels = 6) {
  const texts = [];
  let node = tag;
  for (let level = 0; level < maxLevels && node; level++) {
    if (level > 0 && pattern && countMatchingLinks(node, pattern) > 1) break;
    texts.push(getText(node));
    node = node.parent;
  }
  return texts;
}

export function isLocationExcluded(tag, pattern) {
  const keywords = EXCLUDE_LOCATION_KEYWORDS;
  if (!keywords || !keywords.length) return false;
  for (const text of nearbyOfferTextLevels(tag, pattern)) {
    const lower = text.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) return true;
  }
  return false;
}

const COUNTRY_MAP = {
  polska: "Polska", poland: "Polska",
  niemcy: "Niemcy", germany: "Niemcy", deutschland: "Niemcy",
  holandia: "Holandia", netherlands: "Holandia", nederland: "Holandia",
  belgia: "Belgia", belgium: "Belgia",
  francja: "Francja", france: "Francja",
  włochy: "Włochy", wlochy: "Włochy", italy: "Włochy", italia: "Włochy",
  hiszpania: "Hiszpania", spain: "Hiszpania",
  portugalia: "Portugalia", portugal: "Portugalia",
  austria: "Austria", "österreich": "Austria", osterreich: "Austria",
  szwajcaria: "Szwajcaria", switzerland: "Szwajcaria",
  czechy: "Czechy", "czech republic": "Czechy", czechia: "Czechy",
  słowacja: "Słowacja", slowacja: "Słowacja", slovakia: "Słowacja",
  węgry: "Węgry", wegry: "Węgry", hungary: "Węgry",
  rumunia: "Rumunia", romania: "Rumunia",
  bułgaria: "Bułgaria", bulgaria: "Bułgaria",
  chorwacja: "Chorwacja", croatia: "Chorwacja",
  słowenia: "Słowenia", slowenia: "Słowenia", slovenia: "Słowenia",
  serbia: "Serbia",
  ukraina: "Ukraina", ukraine: "Ukraina",
  litwa: "Litwa", lithuania: "Litwa",
  łotwa: "Łotwa", lotwa: "Łotwa", latvia: "Łotwa",
  estonia: "Estonia",
  szwecja: "Szwecja", sweden: "Szwecja",
  norwegia: "Norwegia", norway: "Norwegia",
  dania: "Dania", denmark: "Dania",
  finlandia: "Finlandia", finland: "Finlandia",
  "wielka brytania": "Wielka Brytania", "united kingdom": "Wielka Brytania",
  "great britain": "Wielka Brytania",
  irlandia: "Irlandia", ireland: "Irlandia",
  grecja: "Grecja", greece: "Grecja",
  turcja: "Turcja", turkey: "Turcja",
  rosja: "Rosja", russia: "Rosja",
  chiny: "Chiny", china: "Chiny",
  "stany zjednoczone": "USA", "united states": "USA", usa: "USA",
  kanada: "Kanada", canada: "Kanada",
  japonia: "Japonia", japan: "Japonia",
  "korea południowa": "Korea Południowa", "south korea": "Korea Południowa",
  indie: "Indie", india: "Indie",
  brazylia: "Brazylia", brazil: "Brazylia",
  australia: "Australia",
};
const COUNTRY_RE = new RegExp(
  "\\b(" +
    Object.keys(COUNTRY_MAP)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|") +
    ")\\b",
  "i"
);

export function findLocationNear(tag, pattern) {
  for (const text of nearbyOfferTextLevels(tag, pattern)) {
    const m = COUNTRY_RE.exec(text);
    if (m) return COUNTRY_MAP[m[1].toLowerCase()];
  }
  return null;
}

function findNextPageUrl(root, currentUrl) {
  const anchors = findAllAnchors(root);
  for (const a of anchors) {
    const rel = (a.attrs.rel || "").toLowerCase();
    if (rel.includes("next")) return new URL(a.attrs.href, currentUrl).toString();
  }
  for (const a of anchors) {
    const aria = (a.attrs["aria-label"] || "").toLowerCase();
    if (NEXT_PAGE_HINTS.some((h) => aria.includes(h))) {
      return new URL(a.attrs.href, currentUrl).toString();
    }
  }
  for (const a of anchors) {
    const text = getText(a).toLowerCase();
    if (NEXT_PAGE_HINTS.includes(text) || [">", "›", "»"].includes(text)) {
      return new URL(a.attrs.href, currentUrl).toString();
    }
  }
  return null;
}

export function extractOffers(html, searchCfg, currentUrl) {
  const root = parseHtml(html);
  const pattern = searchCfg.urlPattern;
  const offers = [];

  // Jedna karta oferty potrafi miec DWA (albo wiecej) linkow <a> wskazujacych
  // na TEN SAM adres - typowo miniaturka zdjecia (bez tekstu) i tytul (z
  // tekstem). Jesli wezmiemy "pierwszy link z tym adresem" i akurat
  // miniaturka wystepuje w kodzie strony PRZED tytulem, to caly dalszy
  // odczyt (tytul, cena, rok, kraj, godziny) byl liczony wzgledem
  // miniaturki - bez tekstu - co dawalo puste/zle dane. Zeby tego uniknac:
  // najpierw grupujemy WSZYSTKIE linki po znormalizowanym adresie, a
  // dopiero potem z kazdej grupy wybieramy najlepszy (majacy tekst) link
  // jako punkt odniesienia.
  const groups = new Map(); // absUrl -> [anchor, anchor, ...] w kolejnosci wystapienia

  for (const a of findAllAnchors(root)) {
    const href = a.attrs.href;
    if (!pattern.test(href)) continue;
    let absUrl;
    try {
      absUrl = new URL(href, searchCfg.base).toString();
    } catch {
      continue;
    }
    absUrl = absUrl.split("#")[0];
    if (!groups.has(absUrl)) groups.set(absUrl, []);
    groups.get(absUrl).push(a);
  }

  for (const [absUrl, anchors] of groups) {
    // Wybierz link z niepustym tekstem (tytul) - jesli takiego nie ma
    // (np. sama miniaturka bez alt), wez pierwszy z listy.
    const a = anchors.find((anchor) => getText(anchor)) || anchors[0];

    let title = getText(a);
    if (!title) {
      for (const anchor of anchors) {
        const img = findFirstImg(anchor);
        if (img && (img.attrs.alt || "").trim()) {
          title = img.attrs.alt.trim();
          break;
        }
      }
    }
    if (!title) title = "(bez tytułu - sprawdź link)";

    if (isLocationExcluded(a, pattern)) continue;

    const price = findPriceNear(a);
    const year = findYearInText(title) || findYearNear(a, price);
    const location = findLocationNear(a, pattern);
    const hours = findHoursNear(a);

    offers.push({ url: absUrl, title, price, year, location, hours });
  }

  const nextUrl = findNextPageUrl(root, currentUrl);
  return { offers, nextUrl };
}

export async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        // Dodatkowe naglowki jak w prawdziwej przegladarce - niektore
        // portale (np. Mascus) odpowiadaja błędem 500 na "podejrzanie gole"
        // zapytania bez tych naglowkow (proste anty-bot rozpoznawanie).
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

// isKnownUrl: opcjonalna funkcja async (url) => bool - "czy tę ofertę już
// mamy w bazie". Jeśli podana, po sprawdzeniu każdej strony listy ofert
// (poza ostatnią wymuszoną): jeżeli WSZYSTKIE oferty na tej stronie są już
// znane, przerywamy sprawdzanie kolejnych stron tego wyszukiwania - listy
// ofert są sortowane najnowsze-najpierw, więc kolejne strony byłyby jeszcze
// starsze i na pewno też już znane. Dzięki temu każdy kolejny przebieg jest
// szybszy (mniej stron do pobrania/sparsowania) - sprawdzamy tylko to, co
// mogło się zmienić/przybyć, nie ładujemy od nowa całej listy.
export async function scrapeSearch(searchCfg, { requestDelayMs = 500, log = () => {}, isKnownUrl = null } = {}) {
  const all = new Map();
  let url = searchCfg.url;
  const pagesLeft = searchCfg.pages || 1;

  for (let pageNo = 1; pageNo <= pagesLeft; pageNo++) {
    let html;
    try {
      html = await fetchHtml(url);
    } catch (exc) {
      log(`Błąd pobierania ${searchCfg.id} (strona ${pageNo}): ${exc}`);
      break;
    }

    const { offers, nextUrl } = extractOffers(html, searchCfg, url);
    for (const o of offers) all.set(o.url, o);

    log(`${searchCfg.id}: strona ${pageNo} -> ${offers.length} ofert (razem ${all.size})`);

    if (pageNo >= pagesLeft || !nextUrl || nextUrl === url) break;

    if (isKnownUrl && offers.length) {
      let anyNew = false;
      for (const o of offers) {
        if (!(await isKnownUrl(o.url))) {
          anyNew = true;
          break;
        }
      }
      if (!anyNew) {
        log(`${searchCfg.id}: strona ${pageNo} nie ma żadnych nowych ofert - pomijam kolejne strony.`);
        break;
      }
    }

    url = nextUrl;
    if (requestDelayMs) await new Promise((r) => setTimeout(r, requestDelayMs));
  }

  return Array.from(all.values());
}
