import type { ClosingStock, SupplyVerification } from '../types';

const PLATTER_FILLINGS = ['Veg', 'Paneer', 'Cheese Corn'];

export interface ReconciledItem {
  supplyItemId: number;
  displayName: string;
  category: string;
  piecesPer: number;
  /** Yesterday's closing count plus today's supply, in pieces. */
  openingTotalPieces: number;
  /** Sold, plus taken by staff, in pieces. */
  consumedPieces: number;
  expectedPackets: number;
  expectedPieces: number;
  expectedTotalPieces: number;
  actualPackets: number;
  actualPieces: number;
  actualTotalPieces: number;
  wastagePieces: number;
  /**
   * Momos unaccounted for, in pieces: counted plus wasted, minus expected.
   * Wastage was thrown away, not lost, so it does not count as short.
   * Negative is short, positive is more than expected.
   */
  difference: number;
  hasConflict: boolean;
  conflictReason: string | null;
}

interface MenuRef {
  id: number;
  filling: string;
}

/**
 * Supply display names are not spaced like menu fillings: the packet is
 * "CheeseCorn Momo Packet" while the filling is "Cheese Corn", so match loosely.
 */
export function fillingOf(displayName: string, category: string): string {
  if (category === 'sauce' || category === 'dip') return '';
  if (/cheese\s*corn/i.test(displayName)) return 'Cheese Corn';
  if (/paneer/i.test(displayName)) return 'Paneer';
  if (/veg/i.test(displayName)) return 'Veg';
  return '';
}

/**
 * Compares the day's closing count with what should be left, item by item.
 *
 *   expected   = yesterday's closing + today's supply − momos gone
 *   difference = counted + wasted − expected
 *
 * "Gone" is everything in `orders`, which should hold the day's sales and the
 * staff takeaways (as `{ items }`), since both left stock. A platter is a third
 * of each filling. Sauces and dips have no expected figure beyond opening.
 */
export function reconcileClosingStock(input: {
  closing: ClosingStock | undefined;
  yesterday: ClosingStock | undefined;
  verification: SupplyVerification | null | undefined;
  orders: { items: { menuItemId: number; quantity: number }[] }[];
  menu: MenuRef[];
}): ReconciledItem[] {
  const { closing, yesterday, verification, orders, menu } = input;
  if (!closing?.items?.length) return [];
  const menuMap = new Map(menu.map((m) => [m.id, m]));

  return closing.items.map((item) => {
    const piecesPer = item.piecesPer || 24;
    const actualTotalPieces = item.packetsLeft * piecesPer + item.piecesLeft;

    const yest = yesterday?.items.find((i) => i.supplyItemId === item.supplyItemId);
    const yestTotalPieces = yest ? yest.packetsLeft * piecesPer + yest.piecesLeft : 0;
    const ver = verification?.items.find((i) => i.supplyItemId === item.supplyItemId);
    const supplyTotalPieces = (ver ? (ver.actualQty ?? ver.expectedQty) : 0) * piecesPer;
    const openingTotalPieces = yestTotalPieces + supplyTotalPieces;

    const filling = fillingOf(item.displayName, item.category);
    let consumedPieces = 0;
    if (filling) {
      for (const order of orders) {
        for (const line of order.items) {
          const m = menuMap.get(line.menuItemId);
          if (!m) continue;
          if (m.filling === 'Platter') {
            if (PLATTER_FILLINGS.includes(filling)) consumedPieces += Math.round(line.quantity / 3);
          } else if (m.filling === filling) {
            consumedPieces += line.quantity;
          }
        }
      }
    }

    const expectedTotalPieces = Math.max(0, openingTotalPieces - consumedPieces);
    return {
      supplyItemId: item.supplyItemId,
      displayName: item.displayName,
      category: item.category,
      piecesPer,
      openingTotalPieces,
      consumedPieces,
      expectedPackets: Math.floor(expectedTotalPieces / piecesPer),
      expectedPieces: expectedTotalPieces % piecesPer,
      expectedTotalPieces,
      actualPackets: item.packetsLeft,
      actualPieces: item.piecesLeft,
      actualTotalPieces,
      wastagePieces: item.wastagePieces,
      difference: actualTotalPieces + item.wastagePieces - expectedTotalPieces,
      hasConflict: item.hasConflict,
      conflictReason: item.conflictReason,
    };
  });
}
