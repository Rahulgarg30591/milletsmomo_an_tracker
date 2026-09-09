-- Migration: add beverage menu items (Cold Drink, Water)
-- Additive, data-safe, idempotent. Run once against target database.
--
-- Ids are explicit and MUST match buildMenu() in src/constants/menu.ts, because
-- OrderItems.menu_item_id is a foreign key to MenuItems(id): the 28 momo items
-- occupy 1-28, so beverages take 29 and 30.

SET NOCOUNT ON;

DECLARE @coldDrinkId INT = 29;
DECLARE @waterId     INT = 30;

-- Refuse to run if those ids belong to something else; silently taking the
-- next identity value instead would point every beverage order at the wrong row.
IF EXISTS (SELECT 1 FROM MenuItems WHERE id = @coldDrinkId AND display_name <> 'Cold Drink')
    OR EXISTS (SELECT 1 FROM MenuItems WHERE id = @waterId AND display_name <> 'Water')
BEGIN
    THROW 50001, 'MenuItems id 29/30 is already used by a non-beverage row. Beverage ids must match buildMenu().', 1;
END

SET IDENTITY_INSERT MenuItems ON;

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE id = @coldDrinkId)
BEGIN
    INSERT INTO MenuItems (id, filling, preparation, display_name, full_price, half_price, is_active)
    VALUES (@coldDrinkId, 'Cold Drink', 'Beverages', 'Cold Drink', 10.00, 10.00, 1);
    PRINT 'MenuItems: Cold Drink added (id 29).';
END
ELSE
    PRINT 'MenuItems: Cold Drink already present - skipped.';

IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE id = @waterId)
BEGIN
    INSERT INTO MenuItems (id, filling, preparation, display_name, full_price, half_price, is_active)
    VALUES (@waterId, 'Water', 'Beverages', 'Water', 10.00, 10.00, 1);
    PRINT 'MenuItems: Water added (id 30).';
END
ELSE
    PRINT 'MenuItems: Water already present - skipped.';

SET IDENTITY_INSERT MenuItems OFF;

-- Re-assert prices so a re-run realigns the rows with buildMenu().
UPDATE MenuItems
   SET preparation = 'Beverages', full_price = 10.00, half_price = 10.00, is_active = 1
 WHERE id = @coldDrinkId;

UPDATE MenuItems
   SET preparation = 'Beverages', full_price = 10.00, half_price = 10.00, is_active = 1
 WHERE id = @waterId;

PRINT 'Beverage migration complete.';
