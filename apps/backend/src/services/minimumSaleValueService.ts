import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { FULL_PRICES } from '../constants/menu.js';

interface PacketFillingInfo {
  filling: string;
  basePrice: number;
}

const PACKET_FILLING_MAP: Record<string, PacketFillingInfo> = {
  veg_packet: { filling: 'Veg', basePrice: FULL_PRICES[0][0] },
  paneer_packet: { filling: 'Paneer', basePrice: FULL_PRICES[0][1] },
  cheese_corn_packet: { filling: 'Cheese Corn', basePrice: FULL_PRICES[0][2] },
};

export interface MinimumSaleValueFilling {
  filling: string;
  openingPieces: number;
  closingPieces: number;
  wastagePieces: number;
  consumedPieces: number;
  plates: number;
  basePrice: number;
  minValue: number;
}

export interface MinimumSaleValueResult {
  date: string;
  fillings: MinimumSaleValueFilling[];
  totalMinimumSaleValue: number;
}

/**
 * Compute the minimum sale value for a given date based on stock consumption.
 *
 * For each momo filling (Veg, Paneer, Cheese Corn):
 *   opening  = yesterday's closing pieces + today's verified supply pieces
 *   closing  = today's closing stock pieces
 *   wastage  = wastage pieces recorded at closing
 *   consumed = opening - closing - wastage   (momos actually sold)
 *   plates   = consumed / 6                   (can be decimal)
 *   minValue = plates × basePrice             (Steam full-plate price per filling)
 *
 * @returns null if closing stock has not been submitted for the date.
 */
export async function getMinimumSaleValue(date: string): Promise<MinimumSaleValueResult | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input('date', sql.Date, date);

  const result = await request.query(
    `SELECT
       si.id,
       si.name,
       si.pieces_per,
       COALESCE(ydcs.packets_left, 0)  AS yestPackets,
       COALESCE(ydcs.pieces_left, 0)   AS yestPieces,
       COALESCE(sv.actual_qty, dsoi.quantity, 0) AS supplyQty,
       COALESCE(tdcs.packets_left, 0)  AS todayPackets,
       COALESCE(tdcs.pieces_left, 0)   AS todayPieces,
       COALESCE(tdcs.wastage_pieces, 0) AS wastagePieces,
       CASE WHEN tdcs.id IS NOT NULL THEN 1 ELSE 0 END AS hasClosingStock
     FROM SupplyItems si
     LEFT JOIN DailyClosingStock ydcs
       ON ydcs.supply_item_id = si.id AND ydcs.order_date = DATEADD(day, -1, @date)
     LEFT JOIN DailySupplyOrderItems dsoi
       ON dsoi.supply_item_id = si.id
       AND dsoi.order_id = (SELECT TOP 1 id FROM DailySupplyOrders WHERE order_date = @date)
     LEFT JOIN SupplyVerifications sv
       ON sv.supply_item_id = si.id AND sv.order_date = @date
     LEFT JOIN DailyClosingStock tdcs
       ON tdcs.supply_item_id = si.id AND tdcs.order_date = @date
     WHERE si.category = 'momo_packet' AND si.is_active = 1
     ORDER BY si.id`,
  );

  const rows = result.recordset as Array<{
    id: number;
    name: string;
    pieces_per: number;
    yestPackets: number;
    yestPieces: number;
    supplyQty: number;
    todayPackets: number;
    todayPieces: number;
    wastagePieces: number;
    hasClosingStock: number;
  }>;

  const hasAnyClosing = rows.some((r) => r.hasClosingStock === 1);
  if (!hasAnyClosing) return null;

  const fillings: MinimumSaleValueFilling[] = [];
  let totalMinimumSaleValue = 0;

  for (const row of rows) {
    const info = PACKET_FILLING_MAP[row.name];
    if (!info) continue;

    const piecesPer = row.pieces_per || 24;
    const openingPieces = row.yestPackets * piecesPer + row.yestPieces + row.supplyQty * piecesPer;
    const closingPieces = row.todayPackets * piecesPer + row.todayPieces;
    const wastagePieces = row.wastagePieces;
    const consumedPieces = Math.max(0, openingPieces - closingPieces - wastagePieces);
    const plates = consumedPieces / 6;
    const minValue = Math.round(plates * info.basePrice * 100) / 100;

    fillings.push({
      filling: info.filling,
      openingPieces,
      closingPieces,
      wastagePieces,
      consumedPieces,
      plates: Math.round(plates * 100) / 100,
      basePrice: info.basePrice,
      minValue,
    });

    totalMinimumSaleValue += minValue;
  }

  return {
    date,
    fillings,
    totalMinimumSaleValue: Math.round(totalMinimumSaleValue * 100) / 100,
  };
}
