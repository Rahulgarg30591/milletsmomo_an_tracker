-- Migration: extend StaffOperationLogs operation_type CHECK + add metadata column
-- Additive, data-safe. Run once against target database.

SET NOCOUNT ON;

-- 1. Add metadata NVARCHAR(MAX) column if missing
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'StaffOperationLogs' AND COLUMN_NAME = 'metadata'
)
BEGIN
    ALTER TABLE StaffOperationLogs
        ADD metadata NVARCHAR(MAX) NULL;
    PRINT 'StaffOperationLogs.metadata added.';
END
ELSE
    PRINT 'StaffOperationLogs.metadata already exists — skipped.';

-- 2. Replace CHECK constraint to include new operation types
DECLARE @ck NVARCHAR(128);
SELECT @ck = cc.CONSTRAINT_NAME
FROM   INFORMATION_SCHEMA.CHECK_CONSTRAINTS        cc
JOIN   INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE  ccu
       ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE  ccu.TABLE_NAME  = 'StaffOperationLogs'
AND    ccu.COLUMN_NAME = 'operation_type';

IF @ck IS NOT NULL
BEGIN
    EXEC('ALTER TABLE StaffOperationLogs DROP CONSTRAINT ' + @ck);
    PRINT 'Dropped old constraint: ' + @ck;
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
    WHERE  CONSTRAINT_NAME = 'CK_StaffOperationLogs_Type'
)
BEGIN
    ALTER TABLE StaffOperationLogs
        ADD CONSTRAINT CK_StaffOperationLogs_Type
        CHECK (operation_type IN (
            'verification','closing_stock','order_create','order_update',
            'order_complete','order_delete','supply_order','payment_settlement',
            'expense_save','login'
        ));
    PRINT 'StaffOperationLogs constraint updated.';
END
ELSE
    PRINT 'StaffOperationLogs constraint already up-to-date — skipped.';
