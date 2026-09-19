import { getPool, closePool } from '../src/db/pool.js';

const RETENTION_HOURS = 72;

async function purgeTable(tableName: string): Promise<number> {
  const pool = await getPool();
  // The table name is a literal from the call sites below, never user input,
  // so interpolating it is safe; the retention window is still a parameter.
  const result = await pool.query(
    `DELETE FROM ${tableName} WHERE created_at < NOW() - make_interval(hours => $1)`,
    [RETENTION_HOURS],
  );
  return result.rowCount ?? 0;
}

async function main() {
  const clientDeleted = await purgeTable('client_activity_logs');
  console.log(`Purged ${clientDeleted} client_activity_logs row(s) older than ${RETENTION_HOURS}h.`);

  const staffDeleted = await purgeTable('staff_operation_logs');
  console.log(`Purged ${staffDeleted} staff_operation_logs row(s) older than ${RETENTION_HOURS}h.`);

  await closePool();
}

main().catch((err) => {
  console.error('Log purge failed:', err);
  process.exit(1);
});
