import { getPool, closePool } from '../src/db/pool.js';

const LOG_TABLES = ['ClientActivityLogs', 'StaffOperationLogs'];

interface DatabaseFileRow {
  name: string;
  type: number;
  size: number;
  max_size: number;
  growth: number;
}

async function logFileState(label: string): Promise<void> {
  const pool = await getPool();
  const result = await pool.request().query<DatabaseFileRow>(
    `SELECT name, type, size, max_size, growth FROM sys.database_files WHERE type IN (0, 1) ORDER BY type;`,
  );
  console.log(`\n--- database_files (${label}) ---`);
  for (const f of result.recordset) {
    const kind = f.type === 0 ? 'data' : 'log';
    const sizeMB = (f.size * 8) / 1024;
    const maxMB = f.max_size === -1 ? 'unlimited' : `${(f.max_size * 8) / 1024}`;
    console.log(`  ${kind} "${f.name}": ${sizeMB.toFixed(2)} MB / max ${maxMB} MB (growth ${f.growth})`);
  }
}

async function main(): Promise<void> {
  const pool = await getPool();

  await logFileState('before');

  console.log('\nForcing persistent version store cleanup...');
  try {
    await pool.request().query('EXEC sys.sp_persistent_version_cleanup;');
    console.log('  done.');
  } catch (err) {
    console.warn('  sp_persistent_version_cleanup failed (continuing):', (err as Error).message);
  }

  for (const table of LOG_TABLES) {
    console.log(`\nReorganizing indexes on ${table} (in-place, quota-safe)...`);
    try {
      await pool.request().query(`ALTER INDEX ALL ON ${table} REORGANIZE;`);
      console.log('  done.');
    } catch (err) {
      console.warn(`  REORGANIZE on ${table} failed (continuing):`, (err as Error).message);
    }
  }

  const files = await pool.request().query<DatabaseFileRow>(
    'SELECT name, type, size, max_size, growth FROM sys.database_files WHERE type IN (0, 1) ORDER BY type;',
  );

  for (const file of files.recordset) {
    const label = file.type === 0 ? 'data' : 'log';
    console.log(`\nShrinking ${label} file "${file.name}"...`);
    try {
      const result = await pool.request().query(`DBCC SHRINKFILE ([${file.name}]);`);
      console.log('  done.', JSON.stringify(result.recordset));
    } catch (err) {
      console.warn(`  SHRINKFILE on "${file.name}" failed (continuing):`, (err as Error).message);
    }
  }

  await logFileState('after');

  await closePool();
  console.log('\nStorage maintenance complete.');
}

main().catch((err) => {
  console.error('Storage maintenance failed:', err);
  process.exit(1);
});
