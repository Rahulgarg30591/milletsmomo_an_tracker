import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/pool.js', () => ({
  getPool: vi.fn(),
}));

vi.mock('mssql', () => ({
  default: {
    Date: 'Date',
    Int: 'Int',
  },
}));

import { getPool } from '../../src/db/pool.js';
import { getMinimumSaleValue } from '../../src/services/minimumSaleValueService.js';

const mockGetPool = getPool as unknown as ReturnType<typeof vi.fn>;

function mockPool(recordset: any[]) {
  const request = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockResolvedValue({ recordset }),
  };
  mockGetPool.mockResolvedValue({
    request: () => request,
  } as any);
  return request;
}

const ROWS_FULL = [
  {
    id: 1,
    name: 'veg_packet',
    pieces_per: 24,
    yestPackets: 1,
    yestPieces: 12,
    supplyQty: 3,
    todayPackets: 1,
    todayPieces: 0,
    wastagePieces: 0,
    hasClosingStock: 1,
  },
  {
    id: 2,
    name: 'paneer_packet',
    pieces_per: 24,
    yestPackets: 2,
    yestPieces: 0,
    supplyQty: 4,
    todayPackets: 1,
    todayPieces: 0,
    wastagePieces: 0,
    hasClosingStock: 1,
  },
  {
    id: 3,
    name: 'cheese_corn_packet',
    pieces_per: 24,
    yestPackets: 1,
    yestPieces: 6,
    supplyQty: 2,
    todayPackets: 1,
    todayPieces: 0,
    wastagePieces: 0,
    hasClosingStock: 1,
  },
];

describe('minimumSaleValueService.getMinimumSaleValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when closing stock not submitted', async () => {
    mockPool([
      { ...ROWS_FULL[0], todayPackets: 0, todayPieces: 0, wastagePieces: 0, hasClosingStock: 0 },
      { ...ROWS_FULL[1], todayPackets: 0, todayPieces: 0, wastagePieces: 0, hasClosingStock: 0 },
      { ...ROWS_FULL[2], todayPackets: 0, todayPieces: 0, wastagePieces: 0, hasClosingStock: 0 },
    ]);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).toBeNull();
  });

  it('computes min sale value with opening, closing, wastage, consumed, plates', async () => {
    mockPool(ROWS_FULL);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();
    expect(result!.fillings).toHaveLength(3);

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    const openingVeg = 1 * 24 + 12 + 3 * 24;
    const closingVeg = 1 * 24 + 0;
    const consumedVeg = openingVeg - closingVeg - 0;
    expect(veg.openingPieces).toBe(openingVeg);
    expect(veg.closingPieces).toBe(closingVeg);
    expect(veg.wastagePieces).toBe(0);
    expect(veg.consumedPieces).toBe(consumedVeg);
    expect(veg.plates).toBe(Math.round((consumedVeg / 6) * 100) / 100);
    expect(veg.basePrice).toBe(89);
    expect(veg.minValue).toBe(Math.round((consumedVeg / 6) * 89 * 100) / 100);
  });

  it('subtracts wastage from consumed', async () => {
    mockPool([
      { ...ROWS_FULL[0], wastagePieces: 10 },
      { ...ROWS_FULL[1], wastagePieces: 0 },
      { ...ROWS_FULL[2], wastagePieces: 5 },
    ]);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    const openingVeg = 1 * 24 + 12 + 3 * 24;
    const consumedVeg = openingVeg - 24 - 10;
    expect(veg.wastagePieces).toBe(10);
    expect(veg.consumedPieces).toBe(Math.max(0, consumedVeg));
    expect(veg.plates).toBe(Math.round((Math.max(0, consumedVeg) / 6) * 100) / 100);
  });

  it('handles missing yesterday closing (opening = supply only)', async () => {
    mockPool([
      { ...ROWS_FULL[0], yestPackets: 0, yestPieces: 0 },
      { ...ROWS_FULL[1], yestPackets: 0, yestPieces: 0 },
      { ...ROWS_FULL[2], yestPackets: 0, yestPieces: 0 },
    ]);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.openingPieces).toBe(3 * 24);
  });

  it('uses base prices 89, 109, 129 for Veg, Paneer, Cheese Corn', async () => {
    mockPool(ROWS_FULL);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    const paneer = result!.fillings.find((f) => f.filling === 'Paneer')!;
    const cheese = result!.fillings.find((f) => f.filling === 'Cheese Corn')!;

    expect(veg.basePrice).toBe(89);
    expect(paneer.basePrice).toBe(109);
    expect(cheese.basePrice).toBe(129);
  });

  it('sums totalMinimumSaleValue across all fillings', async () => {
    mockPool(ROWS_FULL);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const expectedTotal = result!.fillings.reduce((sum, f) => sum + f.minValue, 0);
    expect(result!.totalMinimumSaleValue).toBe(Math.round(expectedTotal * 100) / 100);
  });

  it('matches the example: 60 Veg, 120 Paneer, 30 Cheese Corn → ₹3,715', async () => {
    mockPool([
      {
        id: 1,
        name: 'veg_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 3,
        todayPackets: 0,
        todayPieces: 12,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
      {
        id: 2,
        name: 'paneer_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 6,
        todayPackets: 1,
        todayPieces: 0,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
      {
        id: 3,
        name: 'cheese_corn_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 2,
        todayPackets: 0,
        todayPieces: 18,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
    ]);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    const paneer = result!.fillings.find((f) => f.filling === 'Paneer')!;
    const cheese = result!.fillings.find((f) => f.filling === 'Cheese Corn')!;

    expect(veg.consumedPieces).toBe(60);
    expect(veg.plates).toBe(10);
    expect(veg.minValue).toBe(890);

    expect(paneer.consumedPieces).toBe(120);
    expect(paneer.plates).toBe(20);
    expect(paneer.minValue).toBe(2180);

    expect(cheese.consumedPieces).toBe(30);
    expect(cheese.plates).toBe(5);
    expect(cheese.minValue).toBe(645);

    expect(result!.totalMinimumSaleValue).toBe(3715);
  });

  it('handles decimal plates correctly', async () => {
    mockPool([
      {
        id: 1,
        name: 'veg_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 1,
        todayPackets: 0,
        todayPieces: 18,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
      {
        id: 2,
        name: 'paneer_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 0,
        todayPackets: 0,
        todayPieces: 0,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
      {
        id: 3,
        name: 'cheese_corn_packet',
        pieces_per: 24,
        yestPackets: 0,
        yestPieces: 0,
        supplyQty: 0,
        todayPackets: 0,
        todayPieces: 0,
        wastagePieces: 0,
        hasClosingStock: 1,
      },
    ]);

    const result = await getMinimumSaleValue('2026-07-29');
    expect(result).not.toBeNull();

    const veg = result!.fillings.find((f) => f.filling === 'Veg')!;
    expect(veg.openingPieces).toBe(24);
    expect(veg.closingPieces).toBe(18);
    expect(veg.consumedPieces).toBe(6);
    expect(veg.plates).toBe(1);
    expect(veg.minValue).toBe(89);
  });
});
