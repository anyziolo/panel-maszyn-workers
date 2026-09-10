CREATE TABLE IF NOT EXISTS offers (
    url TEXT PRIMARY KEY,
    search_id TEXT NOT NULL,
    search_name TEXT NOT NULL,
    title TEXT,
    price TEXT,
    price_prev TEXT,
    price_changed_at REAL,
    year TEXT,
    portal TEXT,
    location TEXT,
    hours TEXT,
    normalized_title TEXT,
    first_seen REAL NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_offers_first_seen ON offers (first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_offers_search_id ON offers (search_id);
-- Wykrywanie duplikatow (to samo ogloszenie wystawione kilka razy) -
-- po znormalizowanym tytule (marka+model) i roboczogodzinach.
CREATE INDEX IF NOT EXISTS idx_offers_dedupe ON offers (normalized_title, hours);

CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at REAL NOT NULL,
    finished_at REAL,
    new_offers INTEGER DEFAULT 0,
    error TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
