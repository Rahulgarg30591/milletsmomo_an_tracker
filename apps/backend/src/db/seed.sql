SET NOCOUNT ON;

-- ============================================
-- 1. Menu items (24 rows)
-- ============================================
MERGE INTO MenuItems AS target
USING (VALUES
  ('Veg', 'Steam', 'Veg Steam', 89.00, 50.00),
  ('Paneer', 'Steam', 'Paneer Steam', 109.00, 60.00),
  ('Cheese Corn', 'Steam', 'Cheese Corn Steam', 129.00, 70.00),
  ('Platter', 'Steam', 'Platter Steam', 109.00, 60.00),
  ('Veg', 'Fry', 'Veg Fry', 109.00, 60.00),
  ('Paneer', 'Fry', 'Paneer Fry', 129.00, 70.00),
  ('Cheese Corn', 'Fry', 'Cheese Corn Fry', 149.00, 80.00),
  ('Platter', 'Fry', 'Platter Fry', 129.00, 70.00),
  ('Veg', 'Creamy', 'Veg Creamy', 129.00, 60.00),
  ('Paneer', 'Creamy', 'Paneer Creamy', 129.00, 70.00),
  ('Cheese Corn', 'Creamy', 'Cheese Corn Creamy', 149.00, 80.00),
  ('Platter', 'Creamy', 'Platter Creamy', 129.00, 70.00),
  ('Veg', 'Creamy Fry', 'Veg Creamy Fry', 129.00, 70.00),
  ('Paneer', 'Creamy Fry', 'Paneer Creamy Fry', 149.00, 80.00),
  ('Cheese Corn', 'Creamy Fry', 'Cheese Corn Creamy Fry', 169.00, 90.00),
  ('Platter', 'Creamy Fry', 'Platter Creamy Fry', 149.00, 80.00),
  ('Veg', 'Nepalese Kothey', 'Veg Nepalese Kothey', 129.00, 70.00),
  ('Paneer', 'Nepalese Kothey', 'Paneer Nepalese Kothey', 139.00, 75.00),
  ('Cheese Corn', 'Nepalese Kothey', 'Cheese Corn Nepalese Kothey', 149.00, 80.00),
  ('Platter', 'Nepalese Kothey', 'Platter Nepalese Kothey', 139.00, 75.00),
  ('Veg', 'Pan Fried Gravy', 'Veg Pan Fried Gravy', 139.00, 75.00),
  ('Paneer', 'Pan Fried Gravy', 'Paneer Pan Fried Gravy', 149.00, 80.00),
  ('Cheese Corn', 'Pan Fried Gravy', 'Cheese Corn Pan Fried Gravy', 159.00, 85.00),
  ('Platter', 'Pan Fried Gravy', 'Platter Pan Fried Gravy', 149.00, 80.00)
) AS source (filling, preparation, display_name, full_price, half_price)
ON target.filling = source.filling AND target.preparation = source.preparation
WHEN NOT MATCHED THEN
  INSERT (filling, preparation, display_name, full_price, half_price)
  VALUES (source.filling, source.preparation, source.display_name, source.full_price, source.half_price);

-- ============================================
-- 2. User accounts
-- ============================================
-- PINs for login (4-digit):
--   Admin  -> 1703
--   Staff  -> 9865
--
-- Generate new hashes: npm run generate-pin-hash <pin>
--
MERGE INTO Users AS target
USING (VALUES
  ('staff', 'staff', '$2b$10$veSawKHMM2U3EV08JXrs/uFmhfLxsHqLvOij6JjB2.1NG6iGsttA2', 'Cart Staff'),
  ('admin', 'admin', '$2b$10$nQTAqER/jcLsoC0nYyl2OeOXt7fZ0tqXRhwSl3MBxRGIgVLnkjtrO', 'Owner')
) AS source (username, role, pin_hash, display_name)
ON target.username = source.username
WHEN MATCHED THEN
  UPDATE SET pin_hash = source.pin_hash, role = source.role, display_name = source.display_name
WHEN NOT MATCHED THEN
  INSERT (username, role, pin_hash, display_name)
  VALUES (source.username, source.role, source.pin_hash, source.display_name);

-- ============================================
-- 3. Supply items (8 items: 3 momo packets + 5 sauces/dips)
-- ============================================
MERGE INTO SupplyItems AS target
USING (VALUES
  ('veg_packet', 'momo_packet', 138.00, 24, 'Veg Momo Packet (24 Pcs)'),
  ('paneer_packet', 'momo_packet', 158.00, 24, 'Paneer Momo Packet (24 Pcs)'),
  ('cheese_corn_packet', 'momo_packet', 198.00, 24, 'CheeseCorn Momo Packet (24 Pcs)'),
  ('red_sauce', 'sauce', 80.00, 1, 'Red Sauce'),
  ('chipotle', 'dip', 220.00, 1, 'Chipotle'),
  ('schezwan_sauce', 'sauce', 170.00, 1, 'Schezwan Sauce'),
  ('oregano', 'dip', 370.00, 1, 'Oregano'),
  ('molten_cheese', 'dip', 160.00, 1, 'Molten Cheese')
) AS source (name, category, unit_price, pieces_per, display_name)
ON target.name = source.name
WHEN MATCHED THEN
  UPDATE SET category = source.category, unit_price = source.unit_price, pieces_per = source.pieces_per, display_name = source.display_name
WHEN NOT MATCHED THEN
  INSERT (name, category, unit_price, pieces_per, display_name)
  VALUES (source.name, source.category, source.unit_price, source.pieces_per, source.display_name);
