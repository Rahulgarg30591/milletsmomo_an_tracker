import sql from 'mssql';
import { getPool } from '../db/pool.js';

export interface ClosingStockItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  piecesPer: number;
  packetsLeft: number;
  piecesLeft: number;
  wastagePieces: number;
  hasConflict: boolean;
  conflictReason: string | null;
  totalPiecesLeft: number;
}

export interface ClosingStock {
  orderDate: string;
  items: ClosingStockItem[];
  isSubmitted: boolean;
}

export async function getClosingStock(date: string): Promise<ClosingStock | null> {
  const pool = await getPool();

  // Check if there's a supply order for this date
  const orderReq = pool.request();
  orderReq.input('orderDate', sql.Date, date);
  const orderResult = await orderReq.query(
    `SELECT id FROM DailySupplyOrders WHERE order_date = @orderDate`,
  );

  if (orderResult.recordset.length === 0) {
    return null;
  }

  const orderId = orderResult.recordset[0].id;

  // Get supply items from the order
  const itemsReq = pool.request();
  itemsReq.input('orderId', sql.Int, orderId);
  const itemsResult = await itemsReq.query(
    `SELECT doi.supply_item_id, si.display_name, si.category, si.pieces_per
     FROM DailySupplyOrderItems doi
     JOIN SupplyItems si ON doi.supply_item_id = si.id
     WHERE doi.order_id = @orderId
     ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
  );

  if (itemsResult.recordset.length === 0) {
    return null;
  }

  // Get any existing closing stock
  const stockReq = pool.request();
  stockReq.input('orderDate', sql.Date, date);
  const stockResult = await stockReq.query(
    `SELECT supply_item_id, packets_left, pieces_left, wastage_pieces, has_conflict, conflict_reason
     FROM DailyClosingStock WHERE order_date = @orderDate`,
  );

  const stockMap = new Map<number, { packetsLeft: number; piecesLeft: number; wastagePieces: number; hasConflict: boolean; conflictReason: string | null }>();
  for (const row of stockResult.recordset) {
    stockMap.set(row.supply_item_id, {
      packetsLeft: row.packets_left,
      piecesLeft: row.pieces_left,
      wastagePieces: row.wastage_pieces,
      hasConflict: row.has_conflict,
      conflictReason: row.conflict_reason,
    });
  }

  const items: ClosingStockItem[] = itemsResult.recordset.map((row: any) => {
    const s = stockMap.get(row.supply_item_id);
    return {
      supplyItemId: row.supply_item_id,
      displayName: row.display_name,
      category: row.category,
      piecesPer: row.pieces_per,
      packetsLeft: s ? s.packetsLeft : 0,
      piecesLeft: s ? s.piecesLeft : 0,
      wastagePieces: s ? s.wastagePieces : 0,
      hasConflict: s ? s.hasConflict : false,
      conflictReason: s ? s.conflictReason : null,
      totalPiecesLeft: (s ? s.packetsLeft : 0) * row.pieces_per + (s ? s.piecesLeft : 0),
    };
  });

  return {
    orderDate: date,
    items,
    isSubmitted: stockResult.recordset.length > 0,
  };
}

export async function createClosingStock(
  orderDate: string,
  items: { supplyItemId: number; packetsLeft: number; piecesLeft: number; wastagePieces: number; hasConflict: boolean; conflictReason: string | null }[],
  reportedBy: number,
): Promise<ClosingStock> {
  const pool = await getPool();

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Delete existing closing stock for this date
    const deleteReq = transaction.request();
    deleteReq.input('orderDate', sql.Date, orderDate);
    await deleteReq.query(
      `DELETE FROM DailyClosingStock WHERE order_date = @orderDate`,
    );

    for (const item of items) {
      const itemReq = transaction.request();
      itemReq.input('orderDate', sql.Date, orderDate);
      itemReq.input('supplyItemId', sql.Int, item.supplyItemId);
      itemReq.input('packetsLeft', sql.Int, item.packetsLeft);
      itemReq.input('piecesLeft', sql.Int, item.piecesLeft);
      itemReq.input('wastagePieces', sql.Int, item.wastagePieces);
      itemReq.input('hasConflict', sql.Bit, item.hasConflict);
      itemReq.input('conflictReason', sql.NVarChar, item.conflictReason);
      itemReq.input('reportedBy', sql.Int, reportedBy);
      await itemReq.query(
        `INSERT INTO DailyClosingStock (order_date, supply_item_id, packets_left, pieces_left, wastage_pieces, has_conflict, conflict_reason, reported_by)
         VALUES (@orderDate, @supplyItemId, @packetsLeft, @piecesLeft, @wastagePieces, @hasConflict, @conflictReason, @reportedBy)`,
      );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return (await getClosingStock(orderDate))!;
}
