-- Migracja dla juz istniejacej bazy (dodaje kolumny potrzebne do wykrywania
-- zduplikowanych ofert - to samo ogloszenie wystawione kilka razy). Nowe
-- instalacje dostaja te kolumny od razu przez schema.sql - ta migracja jest
-- tylko dla bazy ktora juz istniala PRZED dodaniem tej funkcji.
--
-- Uruchom (jednorazowo):
--   npx wrangler d1 execute panel-maszyn-db --remote --file=./migrations/0001_dedupe_columns.sql
ALTER TABLE offers ADD COLUMN hours TEXT;
ALTER TABLE offers ADD COLUMN normalized_title TEXT;
CREATE INDEX IF NOT EXISTS idx_offers_dedupe ON offers (normalized_title, hours);
