import { describe, it, expect } from 'vitest';
import { getMinimumSaleValue } from '../../src/services/minimumSaleValueService.js';
import { createSupplyOrder, markNoSupply } from '../../src/services/supplyService.js';
import { createClosingStock } from '../../src/services/closingStockService.js';
import { createVerification } from '../../src/services/supplyVerificationService.js';

const YESTERDAY = '2026-08-30';
const TODAY = '2026-08-31';
const ADMIN = 3;
const STAFF = 1;

const VEG_PACKET = 1;     // 24 pieces, Veg base price 89
const PIECES_PER = 24;

function stock(supplyItemId: number, packetsLeft: number, piecesLeft = 0, wastagePieces = 0) {
  return { supplyItemId, packetsLeft, piecesLeft, wastagePieces, hasConflict: false, conflictReason: null };
}

describe('minimumSaleValueService against a real database', () => {
  it('returns null before closing stock is submitted', async () => {
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 2 }], ADMIN);
    expect(await getMinimumSaleValue(TODAY)).toBeNull();
  });

  it('counts yesterday\'s leftovers plus today\'s supply as the opening stock', async () => {
    // The query reaches back a day with `$1::date - 1`; an off-by-one here
    // would silently drop yesterday's stock from the calculation.
    await createClosingStock(YESTERDAY, [stock(VEG_PACKET, 1, 0)], STAFF);
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 2 }], ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 0)], STAFF);

    const result = await getMinimumSaleValue(TODAY);
    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.openingPieces).toBe(3 * PIECES_PER);
    expect(veg.closingPieces).toBe(0);
  });

  it('prefers the verified quantity over what was ordered', async () => {
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
    await createVerification(TODAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 2 }], STAFF);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 0)], STAFF);

    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.openingPieces).toBe(2 * PIECES_PER);
  });

  it('subtracts wastage from what counts as sold', async () => {
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 0, 6)], STAFF);

    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.wastagePieces).toBe(6);
    expect(veg.consumedPieces).toBe(PIECES_PER - 6);
  });

  it('values consumption at the full-plate price per six momos', async () => {
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 0)], STAFF);

    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.consumedPieces).toBe(24);
    expect(veg.plates).toBe(4);
    expect(veg.minValue).toBe(4 * 89);
  });

  it('never reports negative consumption', async () => {
    // More closing stock than opening: a miscount, not negative sales.
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 5, 0)], STAFF);
    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.consumedPieces).toBe(0);
  });

  it('sums the three fillings into the day total', async () => {
    await createSupplyOrder(TODAY, [
      { supplyItemId: 1, quantity: 1 },
      { supplyItemId: 2, quantity: 1 },
      { supplyItemId: 3, quantity: 1 },
    ], ADMIN);
    await createClosingStock(TODAY, [stock(1, 0), stock(2, 0), stock(3, 0)], STAFF);

    const result = await getMinimumSaleValue(TODAY)!;
    expect(result!.fillings).toHaveLength(3);
    const summed = result!.fillings.reduce((s, f) => s + f.minValue, 0);
    expect(result!.totalMinimumSaleValue).toBeCloseTo(summed, 2);
  });

  it('counts loose pieces as well as whole packets', async () => {
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 6)], STAFF);
    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.closingPieces).toBe(6);
    expect(veg.consumedPieces).toBe(18);
  });

  it('counts only yesterday\'s leftovers when the supply order was cancelled', async () => {
    await createClosingStock(YESTERDAY, [stock(VEG_PACKET, 1, 0)], STAFF);
    await createSupplyOrder(TODAY, [{ supplyItemId: VEG_PACKET, quantity: 2 }], ADMIN);
    await createVerification(TODAY, [{ supplyItemId: VEG_PACKET, expectedQty: 2, actualQty: 2 }], STAFF);
    await markNoSupply(TODAY, ADMIN);
    await createClosingStock(TODAY, [stock(VEG_PACKET, 0, 6)], STAFF);

    const veg = (await getMinimumSaleValue(TODAY))!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.openingPieces).toBe(1 * PIECES_PER);
    expect(veg.consumedPieces).toBe(PIECES_PER - 6);
  });
});
