// Orkiestracja przebiegu sprawdzania ofert - port scraper.py.
// Przechodzi po config.SEARCHES, sciaga strony, zapisuje/aktualizuje
// oferty w D1, filtruje NOWE oferty po marce (KEYWORD_FILTER) i zwraca
// podsumowanie. E-mail o nowych ofertach: NIE wyslany na razie (dodamy
// pozniej) - ale i tak oznaczamy wszystko jako "notified", zeby po
// dodaniu e-maili nie posypaly sie stare oferty naraz.

import { SEARCHES, KEYWORD_FILTER, REQUEST_DELAY_MS } from "./config.js";
import { scrapeSearch, normalizeTitle } from "./scraping.js";
import * as db from "./db.js";

export function matchesKeywordFilter(title) {
  if (!KEYWORD_FILTER || !KEYWORD_FILTER.length) return true;
  const lower = (title || "").toLowerCase();
  return KEYWORD_FILTER.some((kw) => lower.includes(kw.toLowerCase()));
}

function sleep(ms) {
  return ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

// manual=true - wymuszone odswiezenie kliknięte na stronie (ignoruje
// pauze - jesli ktos kliknal "Odswiez teraz", to znaczy ze chce
// sprawdzic mimo wszystko), tak jak scraper.py's run(manual=True).
export async function run(env, { manual = false, log = () => {} } = {}) {
  const D1 = env.DB;

  if (!manual && (await db.isPaused(D1))) {
    log("Monitorowanie jest WSTRZYMANE (przycisk na stronie) - pomijam sprawdzanie ofert w tym przebiegu.");
    return { skipped: true, newOffers: 0, error: null };
  }

  const isFirstRun = await db.isFirstRun(D1);
  const runId = await db.startRun(D1);
  if (isFirstRun) {
    log(
      "To pierwsze uruchomienie - zbuduje baze istniejacych ofert bez wysylania e-maila " +
        "(zeby nie wyslac np. 300 maili na start). Od kolejnego uruchomienia beda przychodzic " +
        "tylko naprawde nowe oferty."
    );
  }

  let newOffers = 0;
  let errorMsg = null;

  try {
    for (const searchCfg of SEARCHES) {
      log(`=== Sprawdzam: ${searchCfg.name} ===`);
      let offers;
      try {
        offers = await scrapeSearch(searchCfg, {
          requestDelayMs: REQUEST_DELAY_MS,
          log,
          isKnownUrl: (url) => db.offerExists(D1, url),
        });
      } catch (exc) {
        log(`Blad wyszukiwania ${searchCfg.id}: ${exc}`);
        continue;
      }

      for (const o of offers) {
        const exists = await db.offerExists(D1, o.url);
        if (exists) {
          // Oferta juz jest w bazie - nie liczy sie jako nowa, ale i tak
          // dogrywamy/aktualizujemy jej rok/cene/lokalizacje niezaleznie
          // od filtra marek (filtr dotyczy tylko NOWYCH ofert).
          await db.updateYearIfMissing(D1, o.url, o.year);
          await db.updatePrice(D1, o.url, o.price);
          await db.updateLocationIfMissing(D1, o.url, o.location);
          continue;
        }
        if (!matchesKeywordFilter(o.title)) continue;

        // Ta sama oferta wystawiona kilka razy (np. powtorzona przez
        // sprzedawce, albo zduplikowana na tym samym/innym portalu) -
        // rozpoznajemy po takim samym tytule (marka+model) I takich samych
        // roboczogodzinach. Jesli znajdziemy juz zapisana ofertę z takim
        // samym zestawem, NIE wstawiamy kolejnej kopii (nie pokazujemy jej
        // na stronie, nie liczy się jako nowa).
        const normalizedTitle = normalizeTitle(o.title);
        const duplicateOf = await db.findDuplicateOffer(D1, normalizedTitle, o.hours, o.url);
        if (duplicateOf) {
          log(`Pomijam duplikat "${o.title}" (${o.hours} h) - to samo co ${duplicateOf}`);
          continue;
        }

        await db.insertOffer(D1, {
          url: o.url,
          searchId: searchCfg.id,
          searchName: searchCfg.name,
          title: o.title,
          price: o.price,
          year: o.year,
          portal: searchCfg.portal,
          location: o.location,
          hours: o.hours,
          normalizedTitle,
        });
        newOffers++;
      }

      await sleep(REQUEST_DELAY_MS);
    }

    // E-mail o nowych ofertach: NIE wysylamy na razie (dodamy pozniej).
    // Mimo to oznaczamy WSZYSTKIE jako obsluzone, zeby nie wyslac ich
    // pozniej naraz, gdy e-maile zostana dodane.
    const unnotified = await db.getUnnotified(D1);
    await db.markNotified(D1, unnotified.map((o) => o.url));
  } catch (exc) {
    errorMsg = String(exc && exc.stack ? exc.stack : exc);
    log(`Blad przebiegu: ${errorMsg}`);
  }

  await db.finishRun(D1, runId, newOffers, errorMsg);
  log(`Zakonczono. Nowych ofert w tym przebiegu: ${newOffers}`);
  return { skipped: false, newOffers, error: errorMsg };
}
