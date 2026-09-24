import { bulkValues, query, withTransaction } from '../db/pool.js';

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

interface StockRow {
  supply_item_id: number;
  packets_left: number;
  pieces_left: number;
  wastage_pieces: number;
  has_conflict: boolean;
  conflict_reason: string | null;
}

interface RecordedStock {
  packetsLeft: number;
  piecesLeft: number;
  wastagePieces: number;
  hasConflict: boolean;
  conflictReason: string | null;
}

async function getRecordedStock(date: string): Promise<Map<number, RecordedStock>> {
  const rows = await query<StockRow>(
    `SELECT supply_item_id, packets_left, pieces_left, wastage_pieces, has_conflict, conflict_reason
     FROM daily_closing_stock WHERE order_date = $1`,
    [date],
  );

  const stockMap = new Map<number, RecordedStock>();
  for (const row of rows) {
    stockMap.set(row.supply_item_id, {
      packetsLeft: row.packets_left,
      piecesLeft: row.pieces_left,
      wastagePieces: row.wastage_pieces,
      hasConflict: row.has_conflict,
      conflictReason: row.conflict_reason,
    });
  }
  return stockMap;
}

function toClosingStockItem(
  supplyItemId: number,
  displayName: string,
  category: string,
  piecesPer: number,
  recorded: RecordedStock | undefined,
): ClosingStockItem {
  return {
    supplyItemId,
    displayName,
    category,
    piecesPer,
    packetsLeft: recorded ? recorded.packetsLeft : 0,
    piecesLeft: recorded ? recorded.piecesLeft : 0,
    wastagePieces: recorded ? recorded.wastagePieces : 0,
    hasConflict: recorded ? recorded.hasConflict : false,
    conflictReason: recorded ? recorded.conflictReason : null,
    totalPiecesLeft: (recorded ? recorded.packetsLeft : 0) * piecesPer + (recorded ? recorded.piecesLeft : 0),
  };
}

/**
 * Items to count at closing for a date, overlaid with any count already taken.
 *
 * The list is the union of:
 *   - every active momo packet, so a type left out of today's supply order
 *     (or a day with no order at all) can still be counted;
 *   - every item on today's supply order, which is how sauces and dips appear;
 *   - every item with packets or pieces left over from yesterday's count;
 *   - every item already counted today, so a recorded row never disappears.
 *
 * @returns null when there is nothing to count.
 */
export async function getClosingStock(date: string): Promise<ClosingStock | null> {
  const itemRows = await query<{
    id: number;
    display_name: string;
    category: string;
    pieces_per: number;
  }>(
    `SELECT si.id, si.display_name, si.category, si.pieces_per
     FROM supply_items si
     WHERE (si.category = 'momo_packet' AND si.is_active = TRUE)
        OR si.id IN (
          SELECT doi.supply_item_id
          FROM daily_supply_order_items doi
          JOIN daily_supply_orders dso ON doi.order_id = dso.id
          WHERE dso.order_date = $1
        )
        OR si.id IN (
          SELECT supply_item_id FROM daily_closing_stock
          WHERE order_date = $1::date - 1 AND (packets_left > 0 OR pieces_left > 0)
        )
        OR si.id IN (
          SELECT supply_item_id FROM daily_closing_stock WHERE order_date = $1
        )
     ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
    [date],
  );

  if (itemRows.length === 0) {
    return null;
  }

  const stockMap = await getRecordedStock(date);

  const items = itemRows.map((row) =>
    toClosingStockItem(row.id, row.display_name, row.category, row.pieces_per, stockMap.get(row.id)),
  );

  return {
    orderDate: date,
    items,
    isSubmitted: stockMap.size > 0,
  };
}

export async function createClosingStock(
  orderDate: string,
  items: { supplyItemId: number; packetsLeft: number; piecesLeft: number; wastagePieces: number; hasConflict: boolean; conflictReason: string | null }[],
  reportedBy: number,
): Promise<ClosingStock> {
  await withTransaction(async (client) => {
    // Delete existing closing stock for this date
    await client.query('DELETE FROM daily_closing_stock WHERE order_date = $1', [orderDate]);

    if (items.length > 0) {
      const { text, params } = bulkValues(
        items.map((item) => [
          orderDate,
          item.supplyItemId,
          item.packetsLeft,
          item.piecesLeft,
          item.wastagePieces,
          item.hasConflict,
          item.conflictReason,
          reportedBy,
        ]),
      );
      await client.query(
        `INSERT INTO daily_closing_stock (order_date, supply_item_id, packets_left, pieces_left, wastage_pieces, has_conflict, conflict_reason, reported_by)
         VALUES ${text}`,
        params,
      );
    }
  });

  return (await getClosingStock(orderDate))!;
}
