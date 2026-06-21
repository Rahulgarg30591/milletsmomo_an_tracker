import sql from 'mssql';
import { getPool } from '../db/pool.js';

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
}

export async function getVerification(date: string): Promise<SupplyVerification | null> {
  const pool = await getPool();

  // First check if there's a supply order for this date
  const orderReq = pool.request();
  orderReq.input('orderDate', sql.Date, date);
  const orderResult = await orderReq.query(
    `SELECT id FROM DailySupplyOrders WHERE order_date = @orderDate`,
  );

  if (orderResult.recordset.length === 0) {
    return null; // No supply order for this date
  }

  const orderId = orderResult.recordset[0].id;

  // Get expected items from the supply order
  const expectedReq = pool.request();
  expectedReq.input('orderId', sql.Int, orderId);
  const expectedResult = await expectedReq.query(
    `SELECT doi.supply_item_id, doi.quantity, doi.unit_price, si.display_name, si.category, si.pieces_per
     FROM DailySupplyOrderItems doi
     JOIN SupplyItems si ON doi.supply_item_id = si.id
     WHERE doi.order_id = @orderId
     ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
  );

  if (expectedResult.recordset.length === 0) {
    return null;
  }

  // Get any verifications
  const verifyReq = pool.request();
  verifyReq.input('orderDate', sql.Date, date);
  const verifyResult = await verifyReq.query(
    `SELECT supply_item_id, expected_qty, actual_qty, has_conflict
     FROM SupplyVerifications WHERE order_date = @orderDate`,
  );

  const verifyMap = new Map<number, { expectedQty: number; actualQty: number; hasConflict: boolean }>();
  for (const row of verifyResult.recordset) {
    verifyMap.set(row.supply_item_id, {
      expectedQty: row.expected_qty,
      actualQty: row.actual_qty,
      hasConflict: row.has_conflict,
    });
  }

  const items: SupplyVerificationItem[] = expectedResult.recordset.map((row: any) => {
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
  };
}

export async function listVerifications(startDate: string, endDate: string): Promise<{ orderDate: string; isFullyVerified: boolean; conflictCount: number }[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input('startDate', sql.Date, startDate);
  req.input('endDate', sql.Date, endDate);

  const result = await req.query(
    `SELECT order_date, COUNT(*) as total_items, SUM(CASE WHEN actual_qty IS NOT NULL THEN 1 ELSE 0 END) as verified_items, SUM(CASE WHEN has_conflict = 1 THEN 1 ELSE 0 END) as conflict_count
     FROM SupplyVerifications
     WHERE order_date BETWEEN @startDate AND @endDate
     GROUP BY order_date
     ORDER BY order_date DESC`,
  );

  return result.recordset.map((row: any) => {
    const date = row.order_date instanceof Date ? row.order_date.toISOString().split('T')[0] : row.order_date;
    return {
      orderDate: date,
      isFullyVerified: row.total_items > 0 && row.verified_items === row.total_items,
      conflictCount: row.conflict_count || 0,
    };
  });
}

export async function createVerification(
  orderDate: string,
  items: { supplyItemId: number; expectedQty: number; actualQty: number }[],
  reportedBy: number,
): Promise<SupplyVerification> {
  const pool = await getPool();

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Delete existing verifications for this date
    const deleteReq = transaction.request();
    deleteReq.input('orderDate', sql.Date, orderDate);
    await deleteReq.query(
      `DELETE FROM SupplyVerifications WHERE order_date = @orderDate`,
    );

    for (const item of items) {
      const itemReq = transaction.request();
      itemReq.input('orderDate', sql.Date, orderDate);
      itemReq.input('supplyItemId', sql.Int, item.supplyItemId);
      itemReq.input('expectedQty', sql.Int, item.expectedQty);
      itemReq.input('actualQty', sql.Int, item.actualQty);
      itemReq.input('hasConflict', sql.Bit, item.actualQty !== item.expectedQty);
      itemReq.input('reportedBy', sql.Int, reportedBy);
      await itemReq.query(
        `INSERT INTO SupplyVerifications (order_date, supply_item_id, expected_qty, actual_qty, has_conflict, reported_by)
         VALUES (@orderDate, @supplyItemId, @expectedQty, @actualQty, @hasConflict, @reportedBy)`,
      );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return (await getVerification(orderDate))!;
}
