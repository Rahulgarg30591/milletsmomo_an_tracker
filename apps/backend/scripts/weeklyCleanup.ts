import sql from 'mssql';
import { getPool, closePool } from '../src/db/pool.js';

async function main() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const sundayRow = await transaction.request().query(`
      SELECT MAX(order_date) AS lastSunday
      FROM DailyClosingStock
      WHERE DATEDIFF(DAY, 0, order_date) % 7 = 6;
    `);
    const lastSunday: Date | null = sundayRow.recordset[0]?.lastSunday ?? null;

    console.log('Deleting Orders (cascades to OrderItems)...');
    await transaction.request().query('DELETE FROM Orders;');

    console.log('Deleting DailySupplyOrders (cascades to DailySupplyOrderItems)...');
    await transaction.request().query('DELETE FROM DailySupplyOrders;');

    console.log('Deleting SupplyOrderLogs...');
    await transaction.request().query('DELETE FROM SupplyOrderLogs;');

    console.log('Deleting SupplyVerifications...');
    await transaction.request().query('DELETE FROM SupplyVerifications;');

    if (lastSunday) {
      console.log(`Deleting DailyClosingStock, keeping ${lastSunday.toISOString().slice(0, 10)}...`);
      await transaction
        .request()
        .input('lastSunday', sql.Date, lastSunday)
        .query('DELETE FROM DailyClosingStock WHERE order_date <> @lastSunday;');
    } else {
      console.log('No prior Sunday found in DailyClosingStock — deleting all rows.');
      await transaction.request().query('DELETE FROM DailyClosingStock;');
    }

    console.log('Deleting StaffOperationLogs...');
    await transaction.request().query('DELETE FROM StaffOperationLogs;');

    console.log('Deleting ClientActivityLogs...');
    await transaction.request().query('DELETE FROM ClientActivityLogs;');

    console.log('Deleting DailyPaymentSettlements...');
    await transaction.request().query('DELETE FROM DailyPaymentSettlements;');

    console.log('Deleting DayExpenses...');
    await transaction.request().query('DELETE FROM DayExpenses;');

    await transaction.commit();
    console.log('Weekly cleanup complete.');
  } catch (err) {
    await transaction.rollback();
    throw err;
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error('Weekly cleanup failed:', err);
  process.exit(1);
});
