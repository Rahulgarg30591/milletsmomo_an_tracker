import { getPool, closePool } from '../src/db/pool.js';

const LOG_TABLES = ['ClientActivityLogs', 'StaffOperationLogs'];

interface DatabaseFileRow {
  name: string;
  type: number;
}

async function main() {
  const pool = await getPool();

  console.log('Forcing persistent version store cleanup...');
  await pool.request().query('EXEC sys.sp_persistent_version_cleanup;');

  for (const table of LOG_TABLES) {
    console.log(`Rebuilding indexes on ${table}...`);
    await pool.request().query(`ALTER INDEX ALL ON ${table} REBUILD;`);
  }

  const files = await pool.request().query<DatabaseFileRow>(
    'SELECT name, type FROM sys.database_files WHERE type IN (0, 1);',
  );

  for (const file of files.recordset) {
    const label = file.type === 0 ? 'data' : 'log';
    console.log(`Shrinking ${label} file "${file.name}"...`);
    const result = await pool.request().query(`DBCC SHRINKFILE (${file.name});`);
    console.log(JSON.stringify(result.recordset));
  }

  await closePool();
  console.log('Storage maintenance complete.');
}

main().catch((err) => {
  console.error('Storage maintenance failed:', err);
  process.exit(1);
});
