-- Menu items (24 rows)
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Steam', 'Veg Steam', 89.00, 50.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Steam', 'Paneer Steam', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Steam', 'Cheese Corn Steam', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Steam', 'Platter Steam', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Fry', 'Veg Fry', 109.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Fry', 'Paneer Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Fry', 'Cheese Corn Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Fry', 'Platter Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Creamy', 'Veg Creamy', 129.00, 60.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Creamy', 'Paneer Creamy', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Creamy', 'Cheese Corn Creamy', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Creamy', 'Platter Creamy', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Creamy Fry', 'Veg Creamy Fry', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Creamy Fry', 'Paneer Creamy Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Creamy Fry', 'Cheese Corn Creamy Fry', 169.00, 90.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Creamy Fry', 'Platter Creamy Fry', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Nep. Kothey', 'Veg Nep. Kothey', 129.00, 70.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Nep. Kothey', 'Paneer Nep. Kothey', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Nep. Kothey', 'Cheese Corn Nep. Kothey', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Nep. Kothey', 'Platter Nep. Kothey', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Veg', 'Pan Fried', 'Veg Pan Fried', 139.00, 75.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Paneer', 'Pan Fried', 'Paneer Pan Fried', 149.00, 80.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Cheese Corn', 'Pan Fried', 'Cheese Corn Pan Fried', 159.00, 85.00);
INSERT INTO MenuItems (filling, preparation, display_name, full_price, half_price) VALUES ('Platter', 'Pan Fried', 'Platter Pan Fried', 149.00, 80.00);

-- User accounts
-- Generate hashes: npx tsx apps/backend/scripts/generatePinHash.ts <pin>
INSERT INTO Users (username, role, pin_hash, display_name) VALUES
  ('staff', 'staff', '<BCRYPT_HASH_OF_STAFF_PIN>', 'Cart Staff'),
  ('admin', 'admin', '<BCRYPT_HASH_OF_ADMIN_PIN>', 'Owner');
