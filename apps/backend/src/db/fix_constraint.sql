SET NOCOUNT ON;

-- Find and fix the StaffOperationLogs.operation_type CHECK constraint
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = c.name
FROM sys.check_constraints c
  INNER JOIN sys.tables t ON c.parent_object_id = t.object_id
WHERE t.name = 'StaffOperationLogs'
  AND c.definition LIKE '%operation_type%';

IF @constraintName IS NOT NULL
BEGIN
  DECLARE @dropSql NVARCHAR(MAX) = 'ALTER TABLE StaffOperationLogs DROP CONSTRAINT [' + @constraintName + ']';
  EXEC sp_executesql @dropSql;
  PRINT 'Dropped constraint: ' + @constraintName;
END
ELSE
BEGIN
  PRINT 'No existing CHECK constraint found on operation_type.';
END

ALTER TABLE StaffOperationLogs
  ADD CONSTRAINT CK_StaffOperationLogs_OperationType
  CHECK (operation_type IN ('verification','closing_stock','order_create','order_update','expense_save'));

PRINT 'Created new CHECK constraint with expense_save.';
PRINT 'Done.';
