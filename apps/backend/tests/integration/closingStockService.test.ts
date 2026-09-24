import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import { getClosingStock, createClosingStock } from '../../src/services/closingStockService.js';
import { createSupplyOrder } from '../../src/services/supplyService.js';

const DAY = '2026-08-01';
const ADMIN = 3;
const STAFF = 1;
const YESTERDAY = '2026-07-31';
const VEG_PACKET = 1;      // 24 pieces per packet
const PANEER_PACKET = 2;
const CHEESE_CORN_PACKET = 3;
const RED_SAUCE = 4;

describe('closingStockService against a real database', () => {
  describe('with a supply order for the day', () => {
    it('lists every momo packet plus the ordered sauces, awaiting a count', async () => {
      await createSupplyOrder(DAY, [
        { supplyItemId: VEG_PACKET, quantity: 3 },
        { supplyItemId: RED_SAUCE, quantity: 1 },
      ], ADMIN);

      const stock = await getClosingStock(DAY);
      expect(stock?.items.map((i) => i.supplyItemId))
        .toEqual([VEG_PACKET, PANEER_PACKET, CHEESE_CORN_PACKET, RED_SAUCE]);
      expect(stock?.isSubmitted).toBe(false);
    });

    it('records a count and reports the day as submitted', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const saved = await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 1, piecesLeft: 6,
        wastagePieces: 2, hasConflict: false, conflictReason: null,
      }], STAFF);

      expect(saved.isSubmitted).toBe(true);
      expect(saved.items[0].packetsLeft).toBe(1);
      expect(saved.items[0].wastagePieces).toBe(2);
    });

    it('derives total pieces left from packets and loose pieces', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const saved = await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 2, piecesLeft: 5,
        wastagePieces: 0, hasConflict: false, conflictReason: null,
      }], STAFF);
      expect(saved.items[0].totalPiecesLeft).toBe(2 * 24 + 5);
    });

    it('keeps a conflict reason alongside the flag', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const saved = await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 0, piecesLeft: 0,
        wastagePieces: 0, hasConflict: true, conflictReason: 'packet torn',
      }], STAFF);
      expect(saved.items[0].hasConflict).toBe(true);
      expect(saved.items[0].conflictReason).toBe('packet torn');
    });

    it('replaces an earlier count rather than adding to it', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const entry = {
        supplyItemId: VEG_PACKET, piecesLeft: 0, wastagePieces: 0,
        hasConflict: false, conflictReason: null,
      };
      await createClosingStock(DAY, [{ ...entry, packetsLeft: 1 }], STAFF);
      const second = await createClosingStock(DAY, [{ ...entry, packetsLeft: 2 }], STAFF);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM daily_closing_stock WHERE order_date = $1', [DAY],
      );
      expect(rows[0].n).toBe(1);
      expect(second.items[0].packetsLeft).toBe(2);
    });

    it('refuses loose pieces of a full packet or more', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      // The CHECK constraint keeps pieces_left below a packet; 24 loose pieces
      // is a packet and must be recorded as one.
      await expect(createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 0, piecesLeft: 24,
        wastagePieces: 0, hasConflict: false, conflictReason: null,
      }], STAFF)).rejects.toThrow();
    });
  });

  describe('without a supply order for the day', () => {
    it('falls back to the active momo packets so a count can still be taken', async () => {
      const stock = await getClosingStock(DAY);
      expect(stock).not.toBeNull();
      expect(stock!.items.length).toBeGreaterThan(0);
      expect(stock!.items.every((i) => i.category === 'momo_packet')).toBe(true);
      expect(stock!.isSubmitted).toBe(false);
    });

    it('still records a count against the fallback list', async () => {
      const saved = await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 1, piecesLeft: 0,
        wastagePieces: 0, hasConflict: false, conflictReason: null,
      }], STAFF);
      expect(saved.isSubmitted).toBe(true);
    });
  });

  describe('with a partial supply order', () => {
    const noCount = { piecesLeft: 0, wastagePieces: 0, hasConflict: false, conflictReason: null };

    it('keeps a packet type left out of the order so its leftovers are counted', async () => {
      await createClosingStock(YESTERDAY, [
        { ...noCount, supplyItemId: PANEER_PACKET, packetsLeft: 2 },
      ], STAFF);
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);

      const stock = await getClosingStock(DAY);
      const ids = stock!.items.map((i) => i.supplyItemId);
      expect(ids).toContain(VEG_PACKET);
      expect(ids).toContain(PANEER_PACKET);
      expect(ids).toContain(CHEESE_CORN_PACKET);
    });

    it('still lists the momo packets when only sauces were ordered', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: RED_SAUCE, quantity: 2 }], ADMIN);

      const stock = await getClosingStock(DAY);
      const momo = stock!.items.filter((i) => i.category === 'momo_packet');
      expect(momo.map((i) => i.supplyItemId)).toEqual([VEG_PACKET, PANEER_PACKET, CHEESE_CORN_PACKET]);
      expect(stock!.items.some((i) => i.supplyItemId === RED_SAUCE)).toBe(true);
    });

    it('records and returns a count for a type that was not ordered', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const saved = await createClosingStock(DAY, [
        { ...noCount, supplyItemId: VEG_PACKET, packetsLeft: 1 },
        { ...noCount, supplyItemId: PANEER_PACKET, packetsLeft: 1 },
      ], STAFF);

      const paneer = saved.items.find((i) => i.supplyItemId === PANEER_PACKET)!;
      expect(paneer.packetsLeft).toBe(1);
    });
  });
});
