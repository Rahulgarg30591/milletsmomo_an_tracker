-- Migration: add comment column to Orders table
-- Additive, data-safe. Run once against target database.

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Orders' AND COLUMN_NAME = 'comment'
)
BEGIN
    ALTER TABLE Orders
        ADD comment NVARCHAR(500) NULL;
    PRINT 'Orders.comment added.';
END
ELSE
    PRINT 'Orders.comment already exists — skipped.';
