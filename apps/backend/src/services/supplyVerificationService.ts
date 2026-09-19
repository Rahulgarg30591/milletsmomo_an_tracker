import { query, withTransaction } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export interface SupplyVerificationItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  expectedQty: number;
  actualQty: number | null;
  hasConflict: boolean;
  unitPrice: number;
  piecesPer: number;
}

export interface SupplyVerification {
  orderDate: string;
  items: SupplyVerificationItem[];
  isFullyVerified: boolean;
  conflictCount: number;
  noSupply: boolean;
}

export async function getVerification(date: string): Promise<SupplyVerification | null> {
  // First check if there's a supply order for this date
  const orderRows = await query<{ id: number }>(
    `SELECT id FROM daily_supply_orders WHERE order_date = $1`,
    [date],
  );

  if (orderRows.length === 0) {
    // No supply order — check if admin marked "No Supply Today"
    const logRows = await query<{ metadata: string | null }>(
      `SELECT metadata FROM staff_operation_logs
       WHERE order_date = $1 AND operation_type = $2`,
      [date, 'supply_order'],
    );
    const noSupply = logRows.some((row) => {
      try {
        return row.metadata ? JSON.parse(row.metadata)?.noSupply === true : false;
      } catch {
        return false;
      }
    });
    if (noSupply) {
      return {
        orderDate: date,
        items: [],
        isFullyVerified: false,
        conflictCount: 0,
        noSupply: true,
      };
    }
    return null; // No supply order for this date
  }

  const orderId = orderRows[0].id;

  // Get expected items from the supply order
  const expectedRows = await query<any>(
    `SELECT doi.supply_item_id, doi.quantity, doi.unit_price, si.display_name, si.category, si.pieces_per
     FROM daily_supply_order_items doi
     JOIN supply_items si ON doi.supply_item_id = si.id
     WHERE doi.order_id = $1
     ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
    [orderId],
  );

  if (expectedRows.length === 0) {
    return null;
  }

  // Get any verifications
  const verifyRows = await query<any>(
    `SELECT supply_item_id, expected_qty, actual_qty, has_conflict
     FROM supply_verifications WHERE order_date = $1`,
    [date],
  );

  const verifyMap = new Map<number, { expectedQty: number; actualQty: number; hasConflict: boolean }>();
  for (const row of verifyRows) {
    verifyMap.set(row.supply_item_id, {
      expectedQty: row.expected_qty,
      actualQty: row.actual_qty,
      hasConflict: row.has_conflict,
    });
  }

  const items: SupplyVerificationItem[] = expectedRows.map((row: any) => {
    const v = verifyMap.get(row.supply_item_id);
    return {
      supplyItemId: row.supply_item_id,
      displayName: row.display_name,
      category: row.category,
      expectedQty: row.quantity,
      actualQty: v ? v.actualQty : null,
      hasConflict: v ? v.hasConflict : false,
      unitPrice: row.unit_price,
      piecesPer: row.pieces_per,
    };
  });

  const isFullyVerified = items.every((i) => i.actualQty !== null);
  const conflictCount = items.filter((i) => i.hasConflict).length;

  return {
    orderDate: date,
    items,
    isFullyVerified,
    conflictCount,
    noSupply: false,
  };
}

export async function listVerifications(startDate: string, endDate: string): Promise<{ orderDate: string; isFullyVerified: boolean; conflictCount: number }[]> {
  const rows = await query<{
    order_date: string;
    total_items: number;
    verified_items: number;
    conflict_count: number;
  }>(
    `SELECT order_date,
            COUNT(*) as total_items,
            SUM(CASE WHEN actual_qty IS NOT NULL THEN 1 ELSE 0 END) as verified_items,
            SUM(CASE WHEN has_conflict THEN 1 ELSE 0 END) as conflict_count
     FROM supply_verifications
     WHERE order_date BETWEEN $1 AND $2
     GROUP BY order_date
     ORDER BY order_date DESC`,
    [startDate, endDate],
  );

  return rows.map((row) => ({
    orderDate: formatDate(row.order_date),
    isFullyVerified: row.total_items > 0 && row.verified_items === row.total_items,
    conflictCount: row.conflict_count ?? 0,
  }));
}

export async function createVerification(
  orderDate: string,
  items: { supplyItemId: number; expectedQty: number; actualQty: number }[],
  reportedBy: number,
): Promise<SupplyVerification> {
  await withTransaction(async (client) => {
    // Delete existing verifications for this date
    await client.query('DELETE FROM supply_verifications WHERE order_date = $1', [orderDate]);

    for (const item of items) {
      await client.query(
        `INSERT INTO supply_verifications (order_date, supply_item_id, expected_qty, actual_qty, has_conflict, reported_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderDate,
          item.supplyItemId,
          item.expectedQty,
          item.actualQty,
          item.actualQty !== item.expectedQty,
          reportedBy,
        ],
      );
    }
  });

  return (await getVerification(orderDate))!;
}
