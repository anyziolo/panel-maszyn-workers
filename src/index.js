// Punkt wejscia Workera - routing HTTP (fetch) + zadanie crona (scheduled).
// Odpowiednik app.py (routing) + scraper.py (wywolywany z crona).

import { webSettings, categoryDefs, KEYWORD_FILTER } from "./config.js";
import * as authLib from "./auth.js";
import * as db from "./db.js";
import { toOfferView } from "./offers.js";
import { renderLoginPage, renderIndexPage } from "./render.js";
import { run as runScraper } from "./scraper.js";

// Zamienia KEYWORD_FILTER na liste checkboxow do pokazania na stronie -
// port _brand_groups() z app.py. "cat" i "caterpillar" to ta sama marka,
// wiec laczymy je w jeden checkbox (zeby nie bylo dwoch osobnych "Cat" i
// "Caterpillar").
function brandGroups() {
  const aliases = { cat: "caterpillar" };
  const lowerList = KEYWORD_FILTER.map((k) => k.toLowerCase());
  const seen = new Set();
  const groups = [];
  for (const kw of KEYWORD_FILTER) {
    const kwLower = kw.toLowerCase();
    const canonical = aliases[kwLower] || kwLower;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    let label, keywords;
    if (canonical === "caterpillar" && lowerList.includes("cat")) {
      label = "CAT / Caterpillar";
      keywords = "cat,caterpillar";
    } else {
      label = kwLower === "jcb" ? "JCB" : kwLower.charAt(0).toUpperCase() + kwLower.slice(1);
      keywords = kwLower;
    }
    groups.push({ label, keywords });
  }
  return groups;
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });
}

function html(body, extraHeaders = {}) {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", ...extraHeaders } });
}

async function handleLoginGet() {
  return html(renderLoginPage({}));
}

async function handleLoginPost(request, env, settings) {
  const form = await request.formData();
  const username = form.get("username") || "";
  const password = form.get("password") || "";

  if (!settings.sessionSecret) {
    return html(renderLoginPage({ error: "Panel nie jest skonfigurowany (brak SESSION_SECRET)." }), { status: 500 });
  }

  if (authLib.checkCredentials(username, password, settings)) {
    const cookie = await authLib.createSessionCookie(username, settings.sessionSecret);
    return redirect("/", { "Set-Cookie": cookie });
  }
  return html(renderLoginPage({ error: "Nieprawidłowy login lub hasło." }), { status: 401 });
}

function handleLogout() {
  return redirect("/login", { "Set-Cookie": authLib.clearSessionCookie() });
}

async function handleToggleFlag(env, key) {
  const D1 = env.DB;
  const current = (await db.getSetting(D1, key, "0")) === "1";
  await db.setSetting(D1, key, current ? "0" : "1");
}

function formatDateTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadOfferCategories(env, settings) {
  const D1 = env.DB;
  const cats = categoryDefs();

  const categories = [];
  for (const cat of cats) {
    const rows = await db.getRecentOffersForSearchIds(D1, cat.searchIds, settings.maxOffers);
    const offers = rows.map((r) => toOfferView(r, settings.highlightHours));
    categories.push({
      id: cat.id,
      name: cat.name,
      count: offers.length,
      newCount: offers.filter((o) => o.isNew).length,
      offers,
    });
  }

  const lastRun = await db.getLastRun(D1);
  const lastRunInfo = lastRun
    ? {
        finishedAt: lastRun.finished_at ? formatDateTime(lastRun.finished_at) : "w trakcie...",
        newOffers: lastRun.new_offers || 0,
        error: lastRun.error || null,
      }
    : null;

  const paused = await db.isPaused(D1);
  return { categories, lastRunInfo, paused };
}

async function handleIndex(request, env, settings) {
  const { categories, lastRunInfo, paused } = await loadOfferCategories(env, settings);
  const url = new URL(request.url);
  const refreshing = url.searchParams.get("refreshing") === "1";

  const page = renderIndexPage({
    categories,
    lastRunInfo,
    refreshSeconds: settings.autoRefreshSeconds,
    paused,
    refreshing,
    brands: brandGroups(),
  });
  return html(page);
}

// Reczne odswiezenie kliknięte na stronie - sprawdza oferty natychmiast,
// bez czekania na najblizsze uruchomienie crona. manual=true - ignoruje
// pauze (klikniecie = chce sprawdzic mimo wszystko).
//
// UWAGA: to CZEKA na zakonczenie calego sprawdzania przed przekierowaniem
// (nie odpalamy w tle przez ctx.waitUntil) - na planie Free Cloudflare
// ubija zadania w tle (waitUntil) jeśli trwają za dlugo po wyslaniu
// odpowiedzi ("waitUntil() tasks did not complete... and have been
// cancelled"), co obcinalo sprawdzanie w polowie. Czekajac na wynik od
// razu, cala operacja trwa w ramach jednego zadania HTTP, ktore ma dużo
// wiekszy limit czasu (oczekiwanie na sieć/fetch nie liczy się do limitu
// CPU) - klik na "Odśwież teraz" po prostu trwa kilka-kilkanascie sekund,
// ale konczy sie NAPRAWDE, zamiast urwać się w połowie.
async function handleRefreshNow(env, ctx) {
  await runScraper(env, { manual: true, log: (m) => console.log(m) });
  return redirect("/");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const settings = webSettings(env);

    if (url.pathname === "/login") {
      if (request.method === "GET") return handleLoginGet();
      if (request.method === "POST") return handleLoginPost(request, env, settings);
      return new Response("Method Not Allowed", { status: 405 });
    }

    const user = await authLib.requireAuth(request, settings);
    if (!user) return redirect("/login");

    if (url.pathname === "/logout") return handleLogout();

    if (url.pathname === "/" && request.method === "GET") {
      return handleIndex(request, env, settings);
    }

    if (url.pathname === "/toggle-pause" && request.method === "POST") {
      await handleToggleFlag(env, "paused");
      return redirect("/");
    }

    if (url.pathname === "/refresh-now" && request.method === "POST") {
      return handleRefreshNow(env, ctx);
    }

    if (url.pathname === "/api/offers" && request.method === "GET") {
      const { categories, lastRunInfo, paused } = await loadOfferCategories(env, settings);
      return new Response(JSON.stringify({ categories, lastRun: lastRunInfo, paused }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  // manual=false (domyslnie) - run() sam sprawdzi pauze i pominie przebieg,
  // tak jak scraper.py's run() bez manual=True.
  async scheduled(event, env, ctx) {
    const { newOffers, error, skipped } = await runScraper(env, { log: (m) => console.log(m) });
    if (skipped) return;
    console.log(`Przebieg crona zakonczony: ${newOffers} nowych ofert.${error ? " Blad: " + error : ""}`);
  },
};
