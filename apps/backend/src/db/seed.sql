-- Menu items (24 rows)
-- Use MERGE for idempotent seeding
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
  ('Veg', 'Nep. Kothey', 'Veg Nep. Kothey', 129.00, 70.00),
  ('Paneer', 'Nep. Kothey', 'Paneer Nep. Kothey', 139.00, 75.00),
  ('Cheese Corn', 'Nep. Kothey', 'Cheese Corn Nep. Kothey', 149.00, 80.00),
  ('Platter', 'Nep. Kothey', 'Platter Nep. Kothey', 139.00, 75.00),
  ('Veg', 'Pan Fried', 'Veg Pan Fried', 139.00, 75.00),
  ('Paneer', 'Pan Fried', 'Paneer Pan Fried', 149.00, 80.00),
  ('Cheese Corn', 'Pan Fried', 'Cheese Corn Pan Fried', 159.00, 85.00),
  ('Platter', 'Pan Fried', 'Platter Pan Fried', 149.00, 80.00)
) AS source (filling, preparation, display_name, full_price, half_price)
ON target.filling = source.filling AND target.preparation = source.preparation
WHEN NOT MATCHED THEN
  INSERT (filling, preparation, display_name, full_price, half_price)
  VALUES (source.filling, source.preparation, source.display_name, source.full_price, source.half_price);

-- User accounts
-- Generate hashes: npx tsx apps/backend/scripts/generatePinHash.ts <pin>
MERGE INTO Users AS target
USING (VALUES
  ('staff', 'staff', '$2b$10$veSawKHMM2U3EV08JXrs/uFmhfLxsHqLvOij6JjB2.1NG6iGsttA2', 'Cart Staff'),
  ('admin', 'admin', '$2b$10$X6BXobdllogT/2U.nC5qOenrf4WtDxUzV4mhQL2A4u.Ei758dDOTK', 'Owner')
) AS source (username, role, pin_hash, display_name)
ON target.username = source.username
WHEN MATCHED THEN
  UPDATE SET pin_hash = source.pin_hash, role = source.role, display_name = source.display_name
WHEN NOT MATCHED THEN
  INSERT (username, role, pin_hash, display_name)
  VALUES (source.username, source.role, source.pin_hash, source.display_name);