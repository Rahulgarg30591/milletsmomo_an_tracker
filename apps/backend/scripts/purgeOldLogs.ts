import sql from 'mssql';
import { getPool, closePool } from '../src/db/pool.js';

const RETENTION_HOURS = 72;

async function purgeTable(tableName: string): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  request.input('hours', sql.Int, RETENTION_HOURS);
  const result = await request.query(
    `DELETE FROM ${tableName} WHERE created_at < DATEADD(HOUR, -@hours, SYSUTCDATETIME())`,
  );
  return result.rowsAffected[0] ?? 0;
}

async function main() {
  const clientDeleted = await purgeTable('ClientActivityLogs');
  console.log(`Purged ${clientDeleted} ClientActivityLogs row(s) older than ${RETENTION_HOURS}h.`);

  const staffDeleted = await purgeTable('StaffOperationLogs');
  console.log(`Purged ${staffDeleted} StaffOperationLogs row(s) older than ${RETENTION_HOURS}h.`);

  await closePool();
}

main().catch((err) => {
  console.error('Log purge failed:', err);
  process.exit(1);
});
