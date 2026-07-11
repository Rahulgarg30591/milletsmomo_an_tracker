-- Migration: add created_by to DayExpenses + fix StaffOperationLogs constraint
-- Run this once against the production millets-momo-db database.

SET NOCOUNT ON;

-- 1. Add created_by to DayExpenses (nullable so existing rows are unaffected)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DayExpenses' AND COLUMN_NAME = 'created_by'
)
BEGIN
    ALTER TABLE DayExpenses
        ADD created_by INT NULL REFERENCES Users(id);
    PRINT 'DayExpenses.created_by added.';
END
ELSE
    PRINT 'DayExpenses.created_by already exists — skipped.';

-- 2. Fix StaffOperationLogs CHECK constraint to include expense_save and order_update
--    (The old constraint only allowed verification / closing_stock / order_create)
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
            'verification','closing_stock','order_create','order_update','expense_save'
        ));
    PRINT 'StaffOperationLogs constraint updated.';
END
ELSE
    PRINT 'StaffOperationLogs constraint already up-to-date — skipped.';
