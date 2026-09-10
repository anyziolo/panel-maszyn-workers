# Panel maszyn — wersja Cloudflare Workers

Ten folder to pełny przepisany panel (dawniej Flask/mydevil.net) na
Cloudflare Workers + D1. Wynik: `wrangler deploy` wgrywa całą aplikację
za jedno polecenie — koniec z ręcznym scp/ssh.

Stary serwer mydevil.net **zostaje nietknięty** — to jest osobny,
nowy projekt. Gdy ta wersja będzie dopracowana, wrócimy do mydevil jako
bezpieczniejszego hostingu docelowego.

## Wymagania

- Konto Cloudflare (masz już).
- Node.js zainstalowany na Twoim komputerze (do uruchamiania `npm`/`npx`).
- Domena `maszyny.cerfox.pl` — musi być dodana do Twojego konta Cloudflare
  (jeśli jeszcze nie jest, dodaj ją w panelu Cloudflare jako "Add a site"
  i zmień nameservery u rejestratora domeny na te, które Cloudflare pokaże).

## 1. Instalacja narzędzi (jednorazowo)

Na swoim komputerze, w folderze tego projektu:

```
npm install
npx wrangler login
```

Otworzy się przeglądarka — zaloguj się na swoje konto Cloudflare i zatwierdź.

## 2. Utworzenie bazy danych D1 (jednorazowo)

```
npx wrangler d1 create panel-maszyn-db
```

Polecenie wypisze coś w stylu:

```
[[d1_databases]]
binding = "DB"
database_name = "panel-maszyn-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Skopiuj wartość `database_id` i wklej ją w pliku `wrangler.toml`, w miejscu
`database_id = "WKLEJ_TU_DATABASE_ID_PO_UTWORZENIU"`.

## 3. Wgranie schematu bazy (jednorazowo)

```
npm run db:migrate:remote
```

To tworzy tabele (`offers`, `runs`, `settings`) na prawdziwej bazie D1
w Cloudflare (nie lokalnie).

## 4. Ustawienie sekretów (jednorazowo)

Login i hasło do panelu oraz sekret sesji — **nigdy nie wpisujemy ich do
kodu**, tylko przez `wrangler secret put` (Cloudflare przechowuje je
zaszyfrowane):

```
npx wrangler secret put BASIC_AUTH_USERNAME
npx wrangler secret put BASIC_AUTH_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Dla każdego polecenia wpisz wartość i naciśnij Enter:
- `BASIC_AUTH_USERNAME` — login do logowania w panelu (np. `adam`).
- `BASIC_AUTH_PASSWORD` — hasło do logowania (wybierz mocne hasło).
- `SESSION_SECRET` — dowolny długi, losowy ciąg znaków (np. 40+ znaków,
  możesz wygenerować przez `openssl rand -hex 32` albo wymyślić sam) —
  służy do podpisywania ciasteczka sesji, nie musisz go pamiętać.

## 5. Wdrożenie (deploy)

```
npm run deploy
```

To wgrywa cały panel na Cloudflare Workers. Po chwili dostaniesz adres
w stylu `https://panel-maszyn.<twoja-subdomena>.workers.dev` — pod nim
panel już działa (na razie pod tym tymczasowym adresem).

**Od teraz każda kolejna zmiana w kodzie to tylko `npm run deploy`** —
bez scp, bez ssh, bez restartów przez panel hostingu.

## 6. Podłączenie domeny maszyny.cerfox.pl

W panelu Cloudflare:

1. Wejdź w swoją domenę `cerfox.pl` → **Workers Routes** (albo
   **Workers & Pages** → wybierz Worker `panel-maszyn` → zakładka
   **Triggers** → **Custom Domains**).
2. Kliknij **Add Custom Domain**, wpisz `maszyny.cerfox.pl`, zatwierdź.

Cloudflare sam ustawi potrzebny wpis DNS i certyfikat SSL. Po chwili
`https://maszyny.cerfox.pl` będzie prowadzić do tej wersji panelu.

(Jeśli subdomena `maszyny.cerfox.pl` była wcześniej wpisem DNS
kierującym na stary serwer mydevil — Custom Domain w Workers automatycznie
nadpisze/utworzy potrzebny wpis. Stary serwer mydevil pod swoim własnym
adresem/domeną nadal będzie działał bez zmian, jeśli miał inny adres.)

## 7. Włączenie automatycznego sprawdzania (cron)

Cron jest już skonfigurowany w `wrangler.toml` (`crons = ["0 * * * *"]` —
co godzinę) i włącza się automatycznie po `npm run deploy`. Nic dodatkowo
nie musisz robić. Możesz to zmienić edytując `wrangler.toml` i wdrażając
ponownie.

## Codzienna praca / zmiany w kodzie

Bez auto-deploy (patrz niżej, jak go włączyć):

1. Poproś o zmianę (np. tutaj, na czacie) — dostaniesz zaktualizowane pliki.
2. Podmień pliki w tym folderze na swoim komputerze.
3. `npm run deploy`.

Gotowe — żadnego scp/ssh/restartu przez panel hostingu.

## Auto-deploy (GitHub Actions) — jednorazowa konfiguracja

Z tym, każdy `git push` na branch `main` sam wdroży zmiany na Cloudflare —
nie trzeba już ręcznie wpisywać `npm run deploy`. W projekcie jest już
gotowy plik `.github/workflows/deploy.yml`, który to robi. Zostaje tylko
podłączyć to pod prawdziwe konto GitHub/Cloudflare (jednorazowo):

### 1. Stwórz token API w Cloudflare

1. Wejdź na https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → szablon **"Edit Cloudflare Workers"** (ma uprawnienia
   do Workers i D1) → **Continue to summary** → **Create Token**.
3. Skopiuj wygenerowany token (widoczny tylko raz!).

### 2. Znajdź swój Account ID

W panelu Cloudflare, na stronie głównej konta (Workers & Pages → Overview)
po prawej stronie jest **Account ID** — skopiuj go.

### 3. Wystaw kod na GitHub

Jeśli nie masz jeszcze repozytorium dla tego projektu, w folderze projektu
w PowerShell:

```
git init
git add .
git commit -m "Panel maszyn - wersja Cloudflare Workers"
```

Potem na https://github.com/new stwórz nowe repozytorium (polecam
**Private**), NIE zaznaczaj żadnych opcji typu README/gitignore. Po
utworzeniu GitHub pokaże Ci komendy do wklejenia, w stylu:

```
git remote add origin https://github.com/TWOJA-NAZWA/panel-maszyn-workers.git
git branch -M main
git push -u origin main
```

Wklej i wykonaj je.

### 4. Dodaj sekrety w GitHub

W repozytorium na GitHub: **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**. Dodaj dwa sekrety:

- `CLOUDFLARE_API_TOKEN` — token z kroku 1.
- `CLOUDFLARE_ACCOUNT_ID` — Account ID z kroku 2.

### 5. Gotowe

Od teraz: zmiana w kodzie → `git add . && git commit -m "opis zmiany" &&
git push` → GitHub Actions sam odpali `wrangler deploy` (widać to w
zakładce **Actions** na GitHub, zielony ✓ = wdrożone). Migracje bazy
(`wrangler d1 execute ... --remote`) trzeba nadal odpalać ręcznie, kiedy
akurat są potrzebne (rzadko, tylko gdy zmienia się struktura bazy).

## Testy lokalne (opcjonalnie, dla pewności przed deployem)

W tym projekcie każda część logiki (parsowanie HTML, wyciąganie cen,
lokalizacji, logowanie, baza danych, renderowanie stron) ma testy, które
można odpalić lokalnie bez Cloudflare:

```
npm test
```

Jeśli wszystko napisze "WSZYSTKIE TESTY PRZESZŁY", kod jest
zweryfikowany i bezpieczny do wdrożenia.

(Testy bazy danych używają wbudowanego w Node.js modułu `node:sqlite` do
symulacji D1 — wymaga to Node.js w wersji 22 lub nowszej na Twoim
komputerze. Sam `wrangler deploy`/`dev` nie ma tego wymogu.)

## Aktualizacja bazy przy zmianach kodu (migracje)

Czasem nowa funkcja wymaga dodania kolumny do bazy danych (np. wykrywanie
duplikatów ofert dodało kolumny `hours` i `normalized_title`). `schema.sql`
sam tego nie doda do bazy, która już istnieje (używa `CREATE TABLE IF NOT
EXISTS`, które nie modyfikuje istniejącej tabeli) — do tego służy folder
`migrations/`.

Jeśli w folderze `migrations/` pojawi się nowy plik (dostaniesz o tym
informację przy okazji danej zmiany), uruchom go RAZ:

```
npx wrangler d1 execute panel-maszyn-db --remote --file=./migrations/NAZWA_PLIKU.sql
```

Potem `npm run deploy` jak zwykle.

## Czego jeszcze nie ma (zrobimy później)

- **E-mail o nowych ofertach** — na razie panel tylko pokazuje nowe
  oferty na stronie (podświetlone), nie wysyła e-maili. Dodamy to
  w kolejnym kroku, gdy reszta będzie dopracowana.
- **Powrót na mydevil.net** — to zostaje jako plan na później, gdy ta
  wersja będzie już dopracowana (mydevil jest bardziej zabezpieczony,
  ale wolniejszy do iterowania).

## Co zrobić, jeśli coś nie działa

- **Błąd przy `wrangler deploy` o brakującym `database_id`** — wróć do
  kroku 2, sprawdź czy wkleiłeś prawidłowe ID w `wrangler.toml`.
- **Strona logowania odpowiada błędem 500 "brak SESSION_SECRET"** — wróć
  do kroku 4, sprawdź czy sekrety zostały ustawione (`npx wrangler secret
  list` pokaże ich nazwy, nie wartości).
- **Cron nie uruchamia się / brak nowych ofert** — sprawdź logi na żywo:
  `npx wrangler tail` (pokazuje `console.log` z uruchomień, w tym z crona).
