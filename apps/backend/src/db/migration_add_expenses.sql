SET NOCOUNT ON;

-- Additive migration: add DayExpenses table + extend StaffOperationLogs CHECK
-- Safe for production — no data loss, no drops of existing tables.

-- 1. Create DayExpenses table (if not exists)
IF OBJECT_ID('DayExpenses', 'U') IS NULL
BEGIN
  CREATE TABLE DayExpenses (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    order_date   DATE          NOT NULL,
    description  NVARCHAR(200) NOT NULL,
    amount       DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    created_by   INT           NOT NULL REFERENCES Users(id),
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_DayExpenses_Date ON DayExpenses(order_date DESC);
  PRINT 'Created DayExpenses table.';
END
ELSE
BEGIN
  PRINT 'DayExpenses table already exists — skipping.';
END

-- 2. Extend StaffOperationLogs.operation_type CHECK to include 'expense_save'
-- Find the existing CHECK constraint name dynamically, drop it, recreate with new value.
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = c.name
FROM sys.check_constraints c
  INNER JOIN sys.tables t ON c.parent_object_id = t.object_id
WHERE t.name = 'StaffOperationLogs'
  AND c.definition LIKE '%operation_type%';

IF @constraintName IS NOT NULL
BEGIN
  DECLARE @sql NVARCHAR(MAX) = 'ALTER TABLE StaffOperationLogs DROP CONSTRAINT [' + @constraintName + ']';
  EXEC sp_executesql @sql;
  PRINT 'Dropped existing CHECK constraint: ' + @constraintName;
END

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints c
    INNER JOIN sys.tables t ON c.parent_object_id = t.object_id
    INNER JOIN sys.columns col ON col.object_id = t.object_id AND col.column_id = c.parent_column_id
  WHERE t.name = 'StaffOperationLogs' AND col.name = 'operation_type'
)
BEGIN
  ALTER TABLE StaffOperationLogs
    ADD CONSTRAINT CK_StaffOperationLogs_OperationType
    CHECK (operation_type IN ('verification','closing_stock','order_create','order_update','expense_save'));
  PRINT 'Added new CHECK constraint with expense_save.';
END
ELSE
BEGIN
  PRINT 'CHECK constraint already exists — skipping.';
END

PRINT 'Migration complete.';
