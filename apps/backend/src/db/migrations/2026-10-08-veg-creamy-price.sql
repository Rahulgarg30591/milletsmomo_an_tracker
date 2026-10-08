-- Veg Creamy is ₹109 a full plate, not ₹129. Prices are charged from the
-- code (buildMenu), so this only keeps the reference column in step; seed.sql
-- inserts menu rows with ON CONFLICT DO NOTHING and would not fix an existing
-- database. Safe to run more than once:
--   npm run prod:db:apply -- 2026-10-08-veg-creamy-price.sql
UPDATE menu_items SET full_price = 109.00
WHERE filling = 'Veg' AND preparation = 'Creamy';
