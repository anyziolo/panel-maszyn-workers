-- Dokończenie migracji 0001 - kolumna "hours" już istniała w bazie (czesciowo
-- wykonana wczesniej), wiec ta migracja dodaje tylko to co jeszcze brakuje.
ALTER TABLE offers ADD COLUMN normalized_title TEXT;
CREATE INDEX IF NOT EXISTS idx_offers_dedupe ON offers (normalized_title, hours);
