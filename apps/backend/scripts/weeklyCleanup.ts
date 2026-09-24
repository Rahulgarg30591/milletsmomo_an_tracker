import { withTransaction, closePool } from '../src/db/pool.js';

async function main() {
  try {
    await withTransaction(async (client) => {
      const sundayRow = await client.query<{ lastsunday: string | null }>(`
        SELECT MAX(order_date) AS lastSunday
        FROM daily_closing_stock
        WHERE EXTRACT(DOW FROM order_date) = 0;
      `);
      const lastSunday = sundayRow.rows[0]?.lastsunday ?? null;

      console.log('Deleting orders (cascades to order_items)...');
      await client.query('DELETE FROM orders;');

      console.log('Deleting daily_supply_orders (cascades to daily_supply_order_items)...');
      await client.query('DELETE FROM daily_supply_orders;');

      console.log('Deleting supply_order_logs...');
      await client.query('DELETE FROM supply_order_logs;');

      console.log('Deleting supply_verifications...');
      await client.query('DELETE FROM supply_verifications;');

      if (lastSunday) {
        console.log(`Deleting daily_closing_stock, keeping ${lastSunday}...`);
        await client.query('DELETE FROM daily_closing_stock WHERE order_date <> $1;', [lastSunday]);
      } else {
        console.log('No prior Sunday found in daily_closing_stock — deleting all rows.');
        await client.query('DELETE FROM daily_closing_stock;');
      }

      console.log('Deleting staff_operation_logs...');
      await client.query('DELETE FROM staff_operation_logs;');

      console.log('Deleting client_activity_logs...');
      await client.query('DELETE FROM client_activity_logs;');

      console.log('Deleting daily_payment_settlements...');
      await client.query('DELETE FROM daily_payment_settlements;');

      console.log('Deleting day_expenses...');
      await client.query('DELETE FROM day_expenses;');

      // cylinder_refills is deliberately kept: admin reviews refills by month.
    });

    console.log('Weekly cleanup complete.');
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error('Weekly cleanup failed:', err);
  process.exit(1);
});
