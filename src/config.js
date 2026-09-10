// Konfiguracja "Panelu maszyn" - odpowiednik config.py z wersji Flask/mydevil.
// Sekrety (login/haslo do panelu, klucz sesji) NIE sa tutaj - siedza w
// Cloudflare jako "wrangler secret" i sa dostepne w kodzie jako env.* .

export const CATEGORIES = [
  { id: "koparki_kolowe", name: "Koparki kołowe" },
  { id: "ladowarki_kolowe", name: "Ładowarki kołowe" },
];

export const SEARCHES = [
  {
    id: "mascus_koparki_kolowe",
    category: "koparki_kolowe",
    portal: "Mascus",
    name: "Koparki kołowe (Mascus)",
    url: "https://www.mascus.pl/budownictwo/koparki-kolowe/",
    urlPattern: /\/budownictwo\/koparki-kolowe\/[^"'#\s]+\.html/,
    base: "https://www.mascus.pl",
    pages: 2,
  },
  {
    id: "mascus_ladowarki_kolowe",
    category: "ladowarki_kolowe",
    portal: "Mascus",
    name: "Ładowarki kołowe (Mascus)",
    url: "https://www.mascus.pl/budownictwo/ladowarki-kolowe/",
    urlPattern: /\/budownictwo\/ladowarki-kolowe\/[^"'#\s]+\.html/,
    base: "https://www.mascus.pl",
    pages: 2,
  },
  {
    id: "truck1_koparki_kolowe",
    category: "koparki_kolowe",
    portal: "Truck1",
    name: "Koparki kołowe (Truck1)",
    url: "https://www.truck1-pl.com/maszyny-budowlane/koparki-kolowe",
    urlPattern: /\/maszyny-budowlane\/koparki-kolowe\/[^"'#\s]+-a\d+\.html/,
    base: "https://www.truck1-pl.com",
    pages: 2,
  },
  {
    id: "truck1_ladowarki_kolowe",
    category: "ladowarki_kolowe",
    portal: "Truck1",
    name: "Ładowarki kołowe (Truck1)",
    url: "https://www.truck1-pl.com/maszyny-budowlane/ladowarki-kolowe",
    urlPattern: /\/maszyny-budowlane\/ladowarki-kolowe\/[^"'#\s]+-a\d+\.html/,
    base: "https://www.truck1-pl.com",
    pages: 2,
  },
  {
    id: "machineryline_koparki_kolowe",
    category: "koparki_kolowe",
    portal: "MachineryLine",
    name: "Koparki kołowe (MachineryLine)",
    url: "https://machineryline.com/-/wheel-excavators--c164",
    urlPattern: /\/-\/sale\/wheel-excavators\/[^"'#\s]+--\d+/,
    base: "https://machineryline.com",
    pages: 2,
  },
  {
    id: "machineryline_ladowarki_kolowe",
    category: "ladowarki_kolowe",
    portal: "MachineryLine",
    name: "Ładowarki kołowe (MachineryLine)",
    url: "https://machineryline.com/-/wheel-loaders--c180",
    urlPattern: /\/-\/sale\/wheel-loaders\/[^"'#\s]+--\d+/,
    base: "https://machineryline.com",
    pages: 2,
  },
];

// Filtr marek - jesli lista NIE jest pusta, pokazujemy TYLKO oferty, ktorych
// tytul zawiera przynajmniej jedno z tych slow (wielkosc liter nie ma
// znaczenia). Pusta lista [] = wszystkie marki.
export const KEYWORD_FILTER = [
  "bobcat", "cat", "caterpillar", "volvo", "jcb", "hitachi", "komatsu",
  "liebherr", "case", "atlas", "mecalac",
];

// Lokalizacja - oferty wystawione w Chinach sa calkowicie pomijane,
// niezaleznie od marki.
export const EXCLUDE_LOCATION_KEYWORDS = ["china", "chiny", "chinach", "chińsk", "prc"];

// Kursy walut do przeliczania ceny na PLN (orientacyjnie, aktualizuj recznie).
export const EXCHANGE_RATES = {
  EUR: 4.30,
  USD: 3.90,
};

export const REQUEST_TIMEOUT_MS = 20000;
export const REQUEST_DELAY_MS = 500;
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function categoryDefs() {
  return CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
    searchIds: SEARCHES.filter((s) => s.category === cat.id).map((s) => s.id),
  }));
}

// Ustawienia panelu ktore CZYTA env (patrz README-DEPLOY.md - ustawiane
// przez `wrangler secret put` / [vars] w wrangler.toml).
export function webSettings(env) {
  return {
    autoRefreshSeconds: parseInt(env.AUTO_REFRESH_SECONDS || "60", 10),
    highlightHours: parseFloat(env.HIGHLIGHT_HOURS || "24"),
    maxOffers: parseInt(env.MAX_OFFERS || "300", 10),
    basicAuth: {
      enabled: true,
      username: env.BASIC_AUTH_USERNAME,
      password: env.BASIC_AUTH_PASSWORD,
    },
    sessionSecret: env.SESSION_SECRET,
  };
}
