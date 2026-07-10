import { getPool, closePool } from '../src/db/pool.js';

async function main() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT c.name, c.definition
    FROM sys.check_constraints c
    INNER JOIN sys.tables t ON c.parent_object_id = t.object_id
    WHERE t.name = 'StaffOperationLogs'
  `);
  console.log('CHECK constraints on StaffOperationLogs:');
  console.table(result.recordset);
  await closePool();
}

main().catch((err) => {
  console.error('Query failed:', err);
  process.exit(1);
});
