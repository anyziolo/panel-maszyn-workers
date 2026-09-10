import { renderLoginPage, renderIndexPage, escapeHtml } from "../src/render.js";

let failed = 0;
function check(desc, cond) {
  console.log(`[${cond ? "OK" : "FAIL"}] ${desc}`);
  if (!cond) failed++;
}

// --- escapeHtml ---
check("escapeHtml ucieka znaki specjalne", escapeHtml(`<a href="x">&'</a>`) === "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
check("escapeHtml null/undefined -> ''", escapeHtml(null) === "" && escapeHtml(undefined) === "");

// --- login page ---
const loginNoError = renderLoginPage({});
check("login bez bledu: brak diva .error", !loginNoError.includes('class="error"'));
check("login ma formularz POST /login", loginNoError.includes('action="/login"'));

const loginWithError = renderLoginPage({ error: "Błędny login <script>" });
check("login z bledem: zawiera escapowany komunikat", loginWithError.includes("Błędny login &lt;script&gt;"));
check("login z bledem nie zawiera surowego <script>", !loginWithError.includes("<script>Błędny"));
check("login: zawiera podtytul i stopke", loginNoError.includes("Zaloguj się, aby zobaczyć oferty") && loginNoError.includes("cerfox.pl"));

// --- index page ---
const sampleOffers = [
  {
    url: "https://example.com/a",
    title: "Caterpillar M316 <trap>",
    portal: "Mascus",
    location: "Polska",
    year: "2019",
    price: "€185,000",
    pricePln: "795 500 PLN",
    priceValue: 185000,
    firstSeen: "2026-09-10 10:00",
    isNew: true,
    priceChangedRecently: false,
  },
  {
    url: "https://example.com/b",
    title: "Volvo EW160",
    portal: "Truck1",
    location: "Niemcy",
    year: "2015",
    price: "$50,000",
    pricePln: "195 000 PLN",
    pricePrev: "$45,000",
    priceValue: 50000,
    firstSeen: "2026-09-01 08:00",
    isNew: false,
    priceChangedRecently: true,
  },
];

const categories = [
  {
    id: "koparki_kolowe",
    name: "Koparki kołowe",
    count: 2,
    newCount: 1,
    offers: sampleOffers,
  },
  {
    id: "ladowarki_kolowe",
    name: "Ładowarki kołowe",
    count: 0,
    newCount: 0,
    offers: [],
  },
];

const brands = [{ label: "CAT", keywords: "cat,caterpillar" }];

const page = renderIndexPage({
  categories,
  lastRunInfo: { finishedAt: "2026-09-10 10:05", newOffers: 1, error: null },
  refreshSeconds: 60,
  paused: false,
  refreshing: false,
  brands,
});

check("index: zawiera oba tytuly kategorii", page.includes("Koparki kołowe") && page.includes("Ładowarki kołowe"));
check("index: escapuje tytul oferty (trap)", page.includes("Caterpillar M316 &lt;trap&gt;") && !page.includes("M316 <trap>"));
check("index: badge NOWA dla nowej oferty", page.includes('<span class="badge">NOWA</span>'));
check("index: badge ZMIANA CENY dla oferty ze zmiana", page.includes('<span class="badge price-badge">ZMIANA CENY</span>'));
check("index: pokazuje 'z X na Y' dla zmiany ceny", page.includes("z $45,000 na $50,000"));
check("index: pokazuje przelicznik PLN", page.includes("≈ 795 500 PLN") && page.includes("≈ 195 000 PLN"));
check("index: kategoria bez ofert pokazuje komunikat 'Brak ofert'", page.includes("Brak ofert w tej kategorii jeszcze w bazie."));
check("index: data-total na liczniku kategorii", page.includes('data-total="2"') && page.includes('data-total="0"'));
check("index: checkbox marki obecny", page.includes('class="f-brand" value="cat,caterpillar"'));
check("index: link wylogowania obecny", page.includes('href="/logout"'));
check("index: pasek pauzy nieobecny gdy paused=false", !page.includes("WSTRZYMANE"));

const pausedPage = renderIndexPage({
  categories,
  lastRunInfo: null,
  refreshSeconds: 30,
  paused: true,
  refreshing: true,
  brands,
});
check("index: pasek pauzy widoczny gdy paused=true", pausedPage.includes("WSTRZYMANE"));
check("index: pasek odswiezania widoczny gdy refreshing=true", pausedPage.includes("Sprawdzanie ofert uruchomione w tle"));
check("index: brak lastRunInfo -> komunikat o cronie", pausedPage.includes("Skrypt sprawdzający oferty jeszcze się nie uruchomił"));

console.log(failed ? `\n${failed} test(y) NIEUDANE` : "\nWSZYSTKIE TESTY PRZESZLY.");
process.exit(failed ? 1 : 0);
