// Renderowanie stron HTML - port templates/index.html i login.html (bez
// Jinja - budujemy string bezposrednio, ale ten sam wyglad/zachowanie).

export function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderLoginPage({ error } = {}) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logowanie - Panel maszyn</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: linear-gradient(135deg, #1c1e21 0%, #33373d 100%);
    color: #1c1e21;
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .card {
    background: #fff;
    width: 100%;
    max-width: 380px;
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.35);
    padding: 36px 32px;
  }
  .logo { text-align: center; font-size: 40px; margin-bottom: 4px; }
  h1 {
    text-align: center;
    font-size: 20px;
    margin: 0 0 4px;
    color: #1c1e21;
  }
  .subtitle {
    text-align: center;
    font-size: 13px;
    color: #888;
    margin: 0 0 28px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #444;
    margin-bottom: 6px;
  }
  input[type="text"], input[type="password"] {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    font-size: 15px;
    margin-bottom: 18px;
    background: #fafafa;
    color: #1c1e21;
  }
  input[type="text"]:focus, input[type="password"]:focus {
    outline: none;
    border-color: #1c1e21;
    background: #fff;
  }
  button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #1c1e21;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { background: #34383e; }
  .error {
    background: #fdecea;
    color: #b00020;
    border: 1px solid #f5c2c0;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    margin-bottom: 18px;
  }
  .footer-note {
    text-align: center;
    font-size: 12px;
    color: #aaa;
    margin-top: 22px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🚜</div>
    <h1>Panel maszyn</h1>
    <p class="subtitle">Zaloguj się, aby zobaczyć oferty</p>

    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}

    <form method="post" action="/login" autocomplete="off">
      <label for="username">Login</label>
      <input type="text" id="username" name="username" autofocus required>

      <label for="password">Hasło</label>
      <input type="password" id="password" name="password" required>

      <button type="submit">Zaloguj się</button>
    </form>

    <p class="footer-note">cerfox.pl &middot; monitoring ofert maszyn</p>
  </div>
</body>
</html>`;
}

function renderOfferRow(o) {
  const rowClasses = [o.isNew ? "new" : "", o.priceChangedRecently ? "price-changed" : ""]
    .filter(Boolean)
    .join(" ");
  const priceValueAttr = o.priceValue !== null && o.priceValue !== undefined ? o.priceValue : "";
  return `
          <tr class="${rowClasses}"
              data-title="${escapeHtml((o.title || "").toLowerCase())}"
              data-year="${escapeHtml(o.year || "")}"
              data-price="${priceValueAttr}">
            <td>
              <a class="offer-link" href="${escapeHtml(o.url)}" target="_blank" rel="noopener">${escapeHtml(o.title)}</a>
              ${o.isNew ? '<span class="badge">NOWA</span>' : ""}
              ${o.priceChangedRecently ? '<span class="badge price-badge">ZMIANA CENY</span>' : ""}
            </td>
            <td>${escapeHtml(o.portal)}</td>
            <td>${escapeHtml(o.location || "-")}</td>
            <td>${escapeHtml(o.year || "")}</td>
            <td class="price">
              ${escapeHtml(o.price)}
              ${o.pricePln ? `<span class="price-pln-note">≈ ${escapeHtml(o.pricePln)}</span>` : ""}
              ${o.priceChangedRecently ? `<span class="price-change-note">z ${escapeHtml(o.pricePrev)} na ${escapeHtml(o.price)}</span>` : ""}
            </td>
            <td>${escapeHtml(o.firstSeen)}</td>
          </tr>`;
}

function renderCategory(cat) {
  const countWord = "ofert" + (cat.count === 1 ? "y" : "");
  const newBadge = cat.newCount > 0 ? `<span class="badge count-badge">${cat.newCount} NOWYCH</span>` : "";
  let body;
  if (cat.offers.length) {
    body = `
      <table>
        <thead>
          <tr>
            <th>Oferta</th>
            <th>Portal</th>
            <th>Kraj</th>
            <th>Rok</th>
            <th>Cena</th>
            <th>Zauważono</th>
          </tr>
        </thead>
        <tbody>${cat.offers.map(renderOfferRow).join("")}
          <tr class="no-match-row" style="display:none"><td colspan="6">Brak ofert pasujących do filtrów.</td></tr>
        </tbody>
      </table>`;
  } else {
    body = `<div class="empty">Brak ofert w tej kategorii jeszcze w bazie.</div>`;
  }
  return `
    <section class="category" data-cat-id="${escapeHtml(cat.id)}">
      <h2>
        ${escapeHtml(cat.name)}
        <span class="count" data-total="${cat.count}">(${cat.count} ${countWord})</span>
        ${newBadge}
      </h2>
      ${body}
    </section>`;
}

const PAGE_SCRIPT = `
(function () {
  var refreshForm = document.getElementById('refresh-form');
  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshForm && refreshBtn) {
    refreshForm.addEventListener('submit', function () {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⏳ Uruchamiam...';
    });
  }
})();
(function () {
  var searchInput = document.getElementById('f-search');
  var yearMin = document.getElementById('f-year-min');
  var yearMax = document.getElementById('f-year-max');
  var priceMin = document.getElementById('f-price-min');
  var priceMax = document.getElementById('f-price-max');
  var catBoxes = Array.prototype.slice.call(document.querySelectorAll('.f-cat'));
  var brandBoxes = Array.prototype.slice.call(document.querySelectorAll('.f-brand'));
  var clearBtn = document.getElementById('f-clear');

  function expandYear(v) {
    if (v === null || isNaN(v)) return null;
    if (v >= 100) return v;
    return v <= 30 ? 2000 + v : 1900 + v;
  }

  function applyFilters() {
    var q = (searchInput.value || '').trim().toLowerCase();
    var yMin = expandYear(yearMin.value ? parseInt(yearMin.value, 10) : null);
    var yMax = expandYear(yearMax.value ? parseInt(yearMax.value, 10) : null);
    var pMin = priceMin.value ? parseInt(priceMin.value, 10) : null;
    var pMax = priceMax.value ? parseInt(priceMax.value, 10) : null;

    var activeCats = {};
    catBoxes.forEach(function (cb) { activeCats[cb.value] = cb.checked; });

    var activeBrandKeywords = [];
    var allBrandsChecked = true;
    brandBoxes.forEach(function (cb) {
      if (cb.checked) {
        activeBrandKeywords = activeBrandKeywords.concat(cb.value.split(','));
      } else {
        allBrandsChecked = false;
      }
    });
    var brandFilterActive = brandBoxes.length > 0 && !allBrandsChecked;

    document.querySelectorAll('section.category').forEach(function (section) {
      var catId = section.getAttribute('data-cat-id');
      var show = activeCats[catId] !== false;
      section.classList.toggle('hidden-by-filter', !show);
      if (!show) return;

      var tbody = section.querySelector('tbody');
      if (!tbody) return;
      var anyVisible = false;
      var visibleCount = 0;
      var rows = tbody.querySelectorAll('tr:not(.no-match-row)');
      rows.forEach(function (tr) {
        var title = tr.getAttribute('data-title') || '';
        var yearAttr = tr.getAttribute('data-year');
        var priceAttr = tr.getAttribute('data-price');
        var year = yearAttr ? parseInt(yearAttr, 10) : null;
        var price = priceAttr ? parseInt(priceAttr, 10) : null;

        var ok = true;
        if (q && title.indexOf(q) === -1) ok = false;
        if (ok && brandFilterActive) {
          var matchesBrand = activeBrandKeywords.some(function (kw) {
            return kw && title.indexOf(kw) !== -1;
          });
          if (!matchesBrand) ok = false;
        }
        if (ok && yMin !== null && (year === null || year < yMin)) ok = false;
        if (ok && yMax !== null && (year === null || year > yMax)) ok = false;
        if (ok && pMin !== null && (price === null || price < pMin)) ok = false;
        if (ok && pMax !== null && (price === null || price > pMax)) ok = false;

        tr.classList.toggle('hidden-by-filter', !ok);
        if (ok) { anyVisible = true; visibleCount++; }
      });

      var noMatchRow = tbody.querySelector('.no-match-row');
      if (noMatchRow) {
        noMatchRow.style.display = anyVisible ? 'none' : '';
      }

      var countEl = section.querySelector('h2 .count');
      if (countEl) {
        var total = parseInt(countEl.getAttribute('data-total'), 10) || 0;
        if (visibleCount === total) {
          var word = 'ofert' + (visibleCount === 1 ? 'y' : '');
          countEl.textContent = '(' + visibleCount + ' ' + word + ')';
        } else {
          countEl.textContent = '(' + visibleCount + ' z ' + total + ')';
        }
      }
    });
  }

  [searchInput, yearMin, yearMax, priceMin, priceMax].forEach(function (el) {
    el.addEventListener('input', applyFilters);
  });
  catBoxes.forEach(function (cb) { cb.addEventListener('change', applyFilters); });
  brandBoxes.forEach(function (cb) { cb.addEventListener('change', applyFilters); });
  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    yearMin.value = '';
    yearMax.value = '';
    priceMin.value = '';
    priceMax.value = '';
    catBoxes.forEach(function (cb) { cb.checked = true; });
    brandBoxes.forEach(function (cb) { cb.checked = true; });
    applyFilters();
  });
})();
`;

export function renderIndexPage({ categories, lastRunInfo, refreshSeconds, paused, refreshing, brands }) {
  const statusInner = lastRunInfo
    ? `Ostatnie sprawdzenie: <strong>${escapeHtml(lastRunInfo.finishedAt)}</strong>
          &middot; nowych ofert w tym przebiegu: <strong>${lastRunInfo.newOffers}</strong>
          ${
            lastRunInfo.error
              ? `<div class="err">Błąd ostatniego sprawdzenia: ${escapeHtml(lastRunInfo.error)}</div>`
              : lastRunInfo.newOffers === 0
              ? `<div class="no-new-info">Brak nowych ogłoszeń.</div>`
              : ""
          }`
    : `Skrypt sprawdzający oferty jeszcze się nie uruchomił (cron). Sprawdź konfigurację crona.`;

  const catCheckboxes = categories
    .map((c) => `<label><input type="checkbox" class="f-cat" value="${escapeHtml(c.id)}" checked> ${escapeHtml(c.name)}</label>`)
    .join("\n          ");
  const brandCheckboxes = brands
    .map((b) => `<label><input type="checkbox" class="f-brand" value="${escapeHtml(b.keywords)}" checked> ${escapeHtml(b.label)}</label>`)
    .join("\n          ");

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel maszyn - nowe oferty</title>
<meta http-equiv="refresh" content="${refreshSeconds}">
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: #f4f5f7; color: #1c1e21; margin: 0; padding: 0;
  }
  header {
    background: #1c1e21; color: #fff; padding: 16px 24px;
    display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px;
  }
  header h1 { margin: 0; font-size: 20px; }
  header .meta { font-size: 13px; color: #bbb; }
  main { padding: 20px; max-width: 1500px; margin: 0 auto; }
  .status {
    background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;
    font-size: 14px; color: #555; border: 1px solid #e2e2e2;
  }
  .status .err { color: #b00020; font-weight: 600; }
  .status .no-new-info { color: #888; margin-top: 2px; }
  .categories-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;
  }
  @media (max-width: 900px) {
    .categories-grid { grid-template-columns: 1fr; }
  }
  .category { margin-bottom: 32px; min-width: 0; }
  .category h2 {
    font-size: 18px; margin: 0 0 10px 2px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  }
  .category h2 .count { font-size: 13px; color: #777; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; vertical-align: top; }
  th { background: #fafafa; font-weight: 600; color: #444; }
  tr.new { background: #eafaf0; }
  tr.price-changed { background: #fff9db; }
  tr.new.price-changed { background: #f3f9d9; }
  .price-change-note { display: block; font-size: 12px; font-weight: 600; color: #9a5b00; white-space: nowrap; margin-top: 2px; }
  .price-pln-note { display: block; font-size: 12px; font-weight: 400; color: #777; white-space: nowrap; margin-top: 2px; }
  .badge.price-badge { background: #b8860b; }
  .badge {
    display: inline-block; background: #1a9c4b; color: #fff; font-size: 11px;
    padding: 2px 8px; border-radius: 999px; margin-left: 8px; vertical-align: middle;
  }
  .badge.count-badge { background: #1a9c4b; }
  a.offer-link { color: #0a58ca; text-decoration: none; font-weight: 500; }
  a.offer-link:hover { text-decoration: underline; }
  .price { white-space: nowrap; font-weight: 600; }
  .empty { padding: 24px; text-align: center; color: #888; background: #fff; border-radius: 8px; }
  footer { text-align: center; color: #999; font-size: 12px; padding: 24px; }
  .header-actions { display: flex; align-items: center; gap: 14px; }
  .logout-link { color: #bbb; font-size: 13px; text-decoration: none; }
  .logout-link:hover { color: #fff; text-decoration: underline; }
  .status-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .pause-form button {
    border: none; border-radius: 999px; padding: 8px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .pause-form button.pause { background: #fdecea; color: #b00020; }
  .pause-form button.resume { background: #eafaf0; color: #1a9c4b; }
  .status-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .refresh-btn {
    border: none; border-radius: 999px; padding: 8px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer; background: #e7f0ff; color: #0a58ca;
  }
  .refresh-btn:hover { background: #d6e6ff; }
  .refresh-btn:disabled { opacity: 0.6; cursor: default; }
  .paused-banner {
    background: #fff4e5; border: 1px solid #ffd8a8; color: #9a5b00;
    border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; font-weight: 600;
  }
  .refreshing-banner {
    background: #e7f0ff; border: 1px solid #b9d3ff; color: #0a58ca;
    border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; font-weight: 600;
  }
  .filters {
    background: #fff; border: 1px solid #e2e2e2; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 16px;
  }
  .filters .row {
    display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end;
  }
  .filters .field { display: flex; flex-direction: column; gap: 4px; }
  .filters .field label { font-size: 12px; color: #666; font-weight: 600; }
  .filters .field.grow { flex: 1 1 220px; }
  .filters input[type="text"], .filters input[type="number"] {
    padding: 8px 10px; border: 1px solid #d8d8d8; border-radius: 6px; font-size: 14px;
    background: #fafafa; color: #1c1e21;
  }
  .filters .range { display: flex; gap: 6px; align-items: center; }
  .filters .range input { width: 90px; }
  .filters .cats { display: flex; gap: 14px; flex-wrap: wrap; }
  .filters .cats label {
    display: flex; align-items: center; gap: 6px; font-size: 13px; color: #333;
    background: #f4f5f7; border: 1px solid #e2e2e2; border-radius: 999px; padding: 6px 12px;
    cursor: pointer;
  }
  .filters button.clear {
    border: none; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 600;
    background: #eee; color: #444; cursor: pointer;
  }
  .filters button.clear:hover { background: #e2e2e2; }
  tr.hidden-by-filter { display: none; }
  section.category.hidden-by-filter { display: none; }
  tr.no-match-row td { text-align: center; color: #888; padding: 20px; }
</style>
</head>
<body>
<header>
  <h1>🚜 Panel maszyn &mdash; nowe oferty</h1>
  <div class="header-actions">
    <div class="meta">
      Odświeżanie co ${refreshSeconds}s &middot;
      Kategorie: ${categories.length}
    </div>
    <a class="logout-link" href="/logout">Wyloguj</a>
  </div>
</header>
<main>
  ${paused ? `<div class="paused-banner">⏸ Monitorowanie jest WSTRZYMANE — skrypt nie sprawdza nowych ofert ani nie wysyła e-maili.</div>` : ""}
  ${
    refreshing
      ? `<div class="refreshing-banner">🔄 Sprawdzanie ofert uruchomione w tle — strona sama pokaże nowe wyniki (odśwież za chwilę albo poczekaj na auto-odświeżenie).</div>`
      : ""
  }

  <div class="status">
    <div class="status-row">
      <div>
        ${statusInner}
      </div>
      <div class="status-actions">
        <form method="post" action="/refresh-now" id="refresh-form">
          <button type="submit" class="refresh-btn" id="refresh-btn">🔄 Odśwież teraz</button>
        </form>
        <form class="pause-form" method="post" action="/toggle-pause">
          ${
            paused
              ? `<button type="submit" class="resume">▶ Wznów wyszukiwanie</button>`
              : `<button type="submit" class="pause">⏸ Zatrzymaj wyszukiwanie (plac pełny)</button>`
          }
        </form>
      </div>
    </div>
  </div>

  <div class="filters">
    <div class="row">
      <div class="field grow">
        <label for="f-search">Szukaj (nazwa, model, marka...)</label>
        <input type="text" id="f-search" placeholder="np. 313, CAT, Volvo...">
      </div>
      <div class="field">
        <label>Rok produkcji (np. 16 = 2016)</label>
        <div class="range">
          <input type="number" id="f-year-min" placeholder="od">
          <span>&ndash;</span>
          <input type="number" id="f-year-max" placeholder="do">
        </div>
      </div>
      <div class="field">
        <label>Cena (PLN)</label>
        <div class="range">
          <input type="number" id="f-price-min" placeholder="od">
          <span>&ndash;</span>
          <input type="number" id="f-price-max" placeholder="do">
        </div>
      </div>
      <div class="field">
        <label>Kategorie</label>
        <div class="cats">
          ${catCheckboxes}
        </div>
      </div>
      <div class="field grow">
        <label>Marki</label>
        <div class="cats">
          ${brandCheckboxes}
        </div>
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button type="button" class="clear" id="f-clear">Wyczyść filtry</button>
      </div>
    </div>
  </div>

  <div class="categories-grid">
    ${categories.map(renderCategory).join("")}
  </div>
</main>
<script>${PAGE_SCRIPT}</script>
<footer>Panel maszyn &middot; strona odświeża się automatycznie</footer>
</body>
</html>`;
}
