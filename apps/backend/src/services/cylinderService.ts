import { query, queryOnce } from '../db/pool.js';
import { normalizeText } from '../utils/text.js';

export const CYLINDER_BRANDS = ['HP', 'BP', 'INDANE'] as const;
export type CylinderBrand = (typeof CYLINDER_BRANDS)[number];

export interface CylinderRefill {
  id: number;
  refillDate: string;
  brand: CylinderBrand;
  amount: number;
  /** Where the cylinder came from (agency, dealer, ...); null if not recorded. */
  source: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface CylinderRefillInput {
  brand: CylinderBrand;
  amount: number;
  source: string | null;
}

export interface CylinderBrandTotal {
  brand: CylinderBrand;
  count: number;
  totalAmount: number;
}

export interface CylinderSourceTotal {
  source: string | null;
  count: number;
  totalAmount: number;
}

export interface CylinderMonthReport {
  month: string;
  refills: CylinderRefill[];
  byBrand: CylinderBrandTotal[];
  bySource: CylinderSourceTotal[];
  count: number;
  totalAmount: number;
}

interface RefillRow {
  id: number;
  refill_date: string;
  brand: CylinderBrand;
  amount: number;
  source: string | null;
  created_by: number;
  display_name: string;
  created_at: Date;
  updated_by_name: string | null;
  updated_at: Date | null;
}

const SELECT_REFILLS = `
  SELECT cr.id, cr.refill_date, cr.brand, cr.amount, cr.source, cr.created_by, u.display_name, cr.created_at,
         uu.display_name AS updated_by_name, cr.updated_at
  FROM cylinder_refills cr
  JOIN users u ON cr.created_by = u.id
  LEFT JOIN users uu ON cr.updated_by = uu.id`;

export const normalizeSource = normalizeText;

function toRefill(row: RefillRow): CylinderRefill {
  return {
    id: row.id,
    refillDate: row.refill_date,
    brand: row.brand,
    amount: row.amount,
    source: row.source,
    createdBy: row.created_by,
    createdByName: row.display_name,
    createdAt: row.created_at.toISOString(),
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

/** Refills logged for one day, oldest first. */
export async function getRefillsForDate(date: string): Promise<CylinderRefill[]> {
  const rows = await query<RefillRow>(
    `${SELECT_REFILLS} WHERE cr.refill_date = $1 ORDER BY cr.created_at, cr.id`,
    [date],
  );
  return rows.map(toRefill);
}

/**
 * Refills in a calendar month (`YYYY-MM`), newest first, with totals overall
 * and per brand. Every brand is listed, including ones with no refills.
 */
export async function getMonthReport(month: string): Promise<CylinderMonthReport> {
  const rows = await query<RefillRow>(
    `${SELECT_REFILLS}
     WHERE cr.refill_date >= ($1 || '-01')::date
       AND cr.refill_date < ($1 || '-01')::date + INTERVAL '1 month'
     ORDER BY cr.refill_date DESC, cr.created_at DESC, cr.id DESC`,
    [month],
  );
  const refills = rows.map(toRefill);

  const byBrand = CYLINDER_BRANDS.map((brand) => {
    const ofBrand = refills.filter((r) => r.brand === brand);
    return {
      brand,
      count: ofBrand.length,
      totalAmount: roundMoney(ofBrand.reduce((sum, r) => sum + r.amount, 0)),
    };
  });

  // Grouped case-insensitively under the most recent spelling, biggest spend first.
  const sourceMap = new Map<string, CylinderSourceTotal>();
  for (const r of refills) {
    const key = r.source?.toLowerCase() ?? '';
    const entry = sourceMap.get(key) ?? { source: r.source, count: 0, totalAmount: 0 };
    entry.count += 1;
    entry.totalAmount += r.amount;
    sourceMap.set(key, entry);
  }
  const bySource = [...sourceMap.values()]
    .map((e) => ({ ...e, totalAmount: roundMoney(e.totalAmount) }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    month,
    refills,
    byBrand,
    bySource,
    count: refills.length,
    totalAmount: roundMoney(refills.reduce((sum, r) => sum + r.amount, 0)),
  };
}

/** Record a refill. */
export async function addRefill(
  refillDate: string,
  { brand, amount, source }: CylinderRefillInput,
  createdBy: number,
): Promise<CylinderRefill> {
  // queryOnce: a retried INSERT would record the refill twice.
  const inserted = await queryOnce<{ id: number }>(
    `INSERT INTO cylinder_refills (refill_date, brand, amount, source, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [refillDate, brand, amount, normalizeSource(source), createdBy],
  );
  const rows = await query<RefillRow>(`${SELECT_REFILLS} WHERE cr.id = $1`, [inserted[0].id]);
  return toRefill(rows[0]);
}

/**
 * Correct a refill's brand, price or source. The date and who first logged it
 * stay; who changed it and when are recorded.
 *
 * @returns the refill before and after, or null if it did not exist.
 */
export async function updateRefill(
  id: number,
  { brand, amount, source }: CylinderRefillInput,
  updatedBy: number,
): Promise<{ before: CylinderRefill; after: CylinderRefill } | null> {
  const beforeRows = await query<RefillRow>(`${SELECT_REFILLS} WHERE cr.id = $1`, [id]);
  if (beforeRows.length === 0) return null;

  await query(
    `UPDATE cylinder_refills
     SET brand = $2, amount = $3, source = $4, updated_by = $5, updated_at = NOW()
     WHERE id = $1`,
    [id, brand, amount, normalizeSource(source), updatedBy],
  );
  const afterRows = await query<RefillRow>(`${SELECT_REFILLS} WHERE cr.id = $1`, [id]);
  return { before: toRefill(beforeRows[0]), after: toRefill(afterRows[0]) };
}

/**
 * Sources used before, most recently used first, to suggest while typing.
 * Spellings differing only in case count as one.
 */
export async function getRecentSources(limit = 20): Promise<string[]> {
  const rows = await query<{ source: string; created_at: Date }>(
    `SELECT DISTINCT ON (lower(source)) source, created_at
     FROM cylinder_refills
     WHERE source IS NOT NULL
     ORDER BY lower(source), created_at DESC`,
  );
  return rows
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit)
    .map((r) => r.source);
}

/**
 * Delete a refill logged by mistake.
 *
 * @returns the deleted refill, or null if it did not exist.
 */
export async function deleteRefill(id: number): Promise<CylinderRefill | null> {
  const rows = await query<RefillRow>(`${SELECT_REFILLS} WHERE cr.id = $1`, [id]);
  if (rows.length === 0) return null;
  await query('DELETE FROM cylinder_refills WHERE id = $1', [id]);
  return toRefill(rows[0]);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
