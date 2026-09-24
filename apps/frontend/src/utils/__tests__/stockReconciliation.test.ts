import { describe, it, expect } from 'vitest';
import { reconcileClosingStock, fillingOf } from '../stockReconciliation';
import type { ClosingStock, ClosingStockItem } from '../../types';

const MENU = [
  { id: 1, filling: 'Veg' },
  { id: 2, filling: 'Paneer' },
  { id: 3, filling: 'Cheese Corn' },
  { id: 4, filling: 'Platter' },
];

function item(supplyItemId: number, displayName: string, packetsLeft: number, piecesLeft = 0, extra: Partial<ClosingStockItem> = {}): ClosingStockItem {
  return {
    supplyItemId, displayName, category: 'momo_packet', piecesPer: 24,
    packetsLeft, piecesLeft, wastagePieces: 0, hasConflict: false, conflictReason: null,
    totalPiecesLeft: packetsLeft * 24 + piecesLeft, ...extra,
  };
}

function stock(items: ClosingStockItem[]): ClosingStock {
  return { orderDate: '2026-09-25', items, isSubmitted: true };
}

describe('reconcileClosingStock', () => {
  it('expects yesterday’s count plus supply, less what was sold', () => {
    const [veg] = reconcileClosingStock({
      closing: stock([item(1, 'Veg Momo Packet', 1, 12)]),
      yesterday: stock([item(1, 'Veg Momo Packet', 1)]),
      verification: { orderDate: '', items: [{ supplyItemId: 1, displayName: 'Veg Momo Packet', category: 'momo_packet', piecesPer: 24, expectedQty: 1, actualQty: null, hasConflict: false, unitPrice: 138 }], isFullyVerified: false, conflictCount: 0, noSupply: false },
      orders: [{ items: [{ menuItemId: 1, quantity: 12 }] }],
      menu: MENU,
    });
    // 24 + 24 - 12 = 36 = 1 pkt + 12 pcs, exactly what was counted.
    expect(veg).toMatchObject({ openingTotalPieces: 48, consumedPieces: 12, expectedPackets: 1, expectedPieces: 12, difference: 0 });
  });

  it('counts staff takeaways, passed as orders, as gone from stock', () => {
    const [veg] = reconcileClosingStock({
      closing: stock([item(1, 'Veg Momo Packet', 0, 18)]),
      yesterday: stock([item(1, 'Veg Momo Packet', 1)]),
      verification: null,
      orders: [{ items: [{ menuItemId: 1, quantity: 6 }] }],
      menu: MENU,
    });
    expect(veg.expectedTotalPieces).toBe(18);
    expect(veg.difference).toBe(0);
  });

  it('takes a third of a platter from each filling, including Cheese Corn', () => {
    const rows = reconcileClosingStock({
      closing: stock([item(1, 'Veg Momo Packet', 0), item(3, 'CheeseCorn Momo Packet', 0)]),
      yesterday: stock([item(1, 'Veg Momo Packet', 1), item(3, 'CheeseCorn Momo Packet', 1)]),
      verification: null,
      orders: [{ items: [{ menuItemId: 4, quantity: 6 }] }],
      menu: MENU,
    });
    expect(rows.map((r) => r.consumedPieces)).toEqual([2, 2]);
  });

  it('reports a short count as a negative difference, with the staff flag', () => {
    // 24 expected; 20 counted and 2 wasted leaves 2 unaccounted for.
    const [veg] = reconcileClosingStock({
      closing: stock([item(1, 'Veg Momo Packet', 0, 20, { hasConflict: true, conflictReason: 'torn packet', wastagePieces: 2 })]),
      yesterday: stock([item(1, 'Veg Momo Packet', 1)]),
      verification: null,
      orders: [],
      menu: MENU,
    });
    expect(veg).toMatchObject({ difference: -2, hasConflict: true, conflictReason: 'torn packet', wastagePieces: 2 });
  });

  it('treats wastage that explains the whole gap as a match', () => {
    const [veg] = reconcileClosingStock({
      closing: stock([item(1, 'Veg Momo Packet', 0, 21, { wastagePieces: 3 })]),
      yesterday: stock([item(1, 'Veg Momo Packet', 1)]),
      verification: null,
      orders: [],
      menu: MENU,
    });
    expect(veg.difference).toBe(0);
  });

  it('is empty until there are items to count', () => {
    expect(reconcileClosingStock({ closing: undefined, yesterday: undefined, verification: null, orders: [], menu: MENU })).toEqual([]);
  });
});

describe('fillingOf', () => {
  it('matches packet names loosely and ignores sauces', () => {
    expect(fillingOf('CheeseCorn Momo Packet', 'momo_packet')).toBe('Cheese Corn');
    expect(fillingOf('Paneer Momo Packet', 'momo_packet')).toBe('Paneer');
    expect(fillingOf('Red Sauce', 'sauce')).toBe('');
  });
});
