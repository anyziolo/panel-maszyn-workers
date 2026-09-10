-- Kolumny hours i normalized_title juz istnialy w bazie - zostal tylko
-- indeks. CREATE INDEX IF NOT EXISTS jest bezpieczne nawet jesli juz istnieje.
CREATE INDEX IF NOT EXISTS idx_offers_dedupe ON offers (normalized_title, hours);
