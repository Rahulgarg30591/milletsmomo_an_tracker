import type { PoolClient } from 'pg';
import { query, queryOnce, withTransaction } from '../db/pool.js';
import { normalizeText } from '../utils/text.js';
import { computeLineTotal } from '../utils/pricing.js';
import { buildMenu } from '../constants/menu.js';

export interface StaffLeave {
  id: number;
  staffName: string;
  leaveDate: string;
  reason: string | null;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface StaffLeaveInput {
  staffName: string;
  leaveDate: string;
  reason: string | null;
}

export interface LeaveMonthReport {
  month: string;
  leaves: StaffLeave[];
  /** Leave days per staff member, most first. */
  byStaff: { staffName: string; count: number }[];
  count: number;
}

/** Staff pay this share off the menu price for what they take. */
export const STAFF_TAKEAWAY_DISCOUNT_PCT = 25;

export interface StaffTakeawayItem {
  menuItemId: number;
  itemName: string;
  /** Momo pieces, as on orders: 6 a full plate, 3 a half. */
  quantity: number;
  isHalf: boolean;
  /** What the line sells for on the menu. */
  menuPrice: number;
  /** What the staff member owes for it, after the discount. */
  lineTotal: number;
}

export interface StaffTakeaway {
  id: number;
  staffName: string;
  takeawayDate: string;
  note: string | null;
  items: StaffTakeawayItem[];
  pieces: number;
  menuValue: number;
  discountPct: number;
  amountOwed: number;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface StaffTakeawayInput {
  staffName: string;
  takeawayDate: string;
  note: string | null;
  items: { menuItemId: number; quantity: number; isHalf: boolean }[];
}

export interface TakeawayMonthReport {
  month: string;
  takeaways: StaffTakeaway[];
  byStaff: { staffName: string; count: number; pieces: number; menuValue: number; amountOwed: number }[];
  count: number;
  pieces: number;
  menuValue: number;
  amountOwed: number;
  discountPct: number;
}

interface LeaveRow {
  id: number;
  staff_name: string;
  leave_date: string;
  reason: string | null;
  created_by_name: string;
  created_at: Date;
  updated_by_name: string | null;
  updated_at: Date | null;
}

const SELECT_LEAVES = `
  SELECT sl.id, sl.staff_name, sl.leave_date, sl.reason,
         u.display_name AS created_by_name, sl.created_at,
         uu.display_name AS updated_by_name, sl.updated_at
  FROM staff_leaves sl
  JOIN users u ON sl.created_by = u.id
  LEFT JOIN users uu ON sl.updated_by = uu.id`;

const IN_MONTH = (column: string) =>
  `${column} >= ($1 || '-01')::date AND ${column} < ($1 || '-01')::date + INTERVAL '1 month'`;

function toLeave(row: LeaveRow): StaffLeave {
  return {
    id: row.id,
    staffName: row.staff_name,
    leaveDate: row.leave_date,
    reason: row.reason,
    createdByName: row.created_by_name,
    createdAt: row.created_at.toISOString(),
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Groups by name case-insensitively, labelled with the spelling seen first,
 * which is the most recent since callers pass newest first.
 */
function groupByStaff<T extends { staffName: string }, A>(
  entries: T[],
  empty: () => A,
  add: (acc: A, entry: T) => void,
): (A & { staffName: string })[] {
  const groups = new Map<string, A & { staffName: string }>();
  for (const e of entries) {
    const key = e.staffName.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { ...empty(), staffName: e.staffName };
      groups.set(key, g);
    }
    add(g, e);
  }
  return [...groups.values()];
}

/** A unique violation on (name, date) means the person is already marked absent. */
function duplicateLeave(err: unknown): never {
  if ((err as { code?: string })?.code === '23505') {
    throw Object.assign(new Error('This staff member is already marked absent on that date'), { status: 409 });
  }
  throw err;
}

function cleanLeave(input: StaffLeaveInput) {
  const staffName = normalizeText(input.staffName);
  if (!staffName) throw Object.assign(new Error('Staff name is required'), { status: 400 });
  return { staffName, leaveDate: input.leaveDate, reason: normalizeText(input.reason) };
}

/** Leaves in a calendar month (`YYYY-MM`), newest first, with days per person. */
export async function getLeaveMonth(month: string): Promise<LeaveMonthReport> {
  const rows = await query<LeaveRow>(
    `${SELECT_LEAVES} WHERE ${IN_MONTH('sl.leave_date')}
     ORDER BY sl.leave_date DESC, sl.created_at DESC, sl.id DESC`,
    [month],
  );
  const leaves = rows.map(toLeave);
  const byStaff = groupByStaff(leaves, () => ({ count: 0 }), (g) => { g.count += 1; })
    .sort((a, b) => b.count - a.count || a.staffName.localeCompare(b.staffName));
  return { month, leaves, byStaff, count: leaves.length };
}

/** Mark a staff member absent. */
export async function addLeave(input: StaffLeaveInput, createdBy: number): Promise<StaffLeave> {
  const { staffName, leaveDate, reason } = cleanLeave(input);
  // queryOnce: a retried INSERT would hit the unique index and misreport a duplicate.
  const inserted = await queryOnce<{ id: number }>(
    `INSERT INTO staff_leaves (staff_name, leave_date, reason, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [staffName, leaveDate, reason, createdBy],
  ).catch(duplicateLeave);
  const rows = await query<LeaveRow>(`${SELECT_LEAVES} WHERE sl.id = $1`, [inserted[0].id]);
  return toLeave(rows[0]);
}

/**
 * Correct a leave's name, date or reason.
 *
 * @returns the leave before and after, or null if it did not exist.
 */
export async function updateLeave(
  id: number,
  input: StaffLeaveInput,
  updatedBy: number,
): Promise<{ before: StaffLeave; after: StaffLeave } | null> {
  const beforeRows = await query<LeaveRow>(`${SELECT_LEAVES} WHERE sl.id = $1`, [id]);
  if (beforeRows.length === 0) return null;
  const { staffName, leaveDate, reason } = cleanLeave(input);
  await query(
    `UPDATE staff_leaves
     SET staff_name = $2, leave_date = $3, reason = $4, updated_by = $5, updated_at = NOW()
     WHERE id = $1`,
    [id, staffName, leaveDate, reason, updatedBy],
  ).catch(duplicateLeave);
  const afterRows = await query<LeaveRow>(`${SELECT_LEAVES} WHERE sl.id = $1`, [id]);
  return { before: toLeave(beforeRows[0]), after: toLeave(afterRows[0]) };
}

/** @returns the deleted leave, or null if it did not exist. */
export async function deleteLeave(id: number): Promise<StaffLeave | null> {
  const rows = await query<LeaveRow>(`${SELECT_LEAVES} WHERE sl.id = $1`, [id]);
  if (rows.length === 0) return null;
  await query('DELETE FROM staff_leaves WHERE id = $1', [id]);
  return toLeave(rows[0]);
}

const menu = buildMenu();

const SELECT_TAKEAWAYS = `
  SELECT st.id, st.staff_name, st.takeaway_date, st.note, st.menu_value, st.discount_pct, st.amount_owed,
         u.display_name AS created_by_name, st.created_at,
         uu.display_name AS updated_by_name, st.updated_at
  FROM staff_takeaways st
  JOIN users u ON st.created_by = u.id
  LEFT JOIN users uu ON st.updated_by = uu.id`;

interface TakeawayRow {
  id: number;
  staff_name: string;
  takeaway_date: string;
  note: string | null;
  menu_value: number;
  discount_pct: number;
  amount_owed: number;
  created_by_name: string;
  created_at: Date;
  updated_by_name: string | null;
  updated_at: Date | null;
}

/** Loads takeaways with their items, in the order the rows were given. */
async function withItems(rows: TakeawayRow[]): Promise<StaffTakeaway[]> {
  if (rows.length === 0) return [];
  const itemRows = await query<{
    takeaway_id: number;
    menu_item_id: number;
    item_name: string;
    quantity: number;
    is_half: boolean;
    menu_price: number;
    line_total: number;
  }>(
    `SELECT takeaway_id, menu_item_id, item_name, quantity, is_half, menu_price, line_total
     FROM staff_takeaway_items WHERE takeaway_id = ANY($1::int[]) ORDER BY id`,
    [rows.map((r) => r.id)],
  );
  const itemsById = new Map<number, StaffTakeawayItem[]>();
  for (const i of itemRows) {
    const list = itemsById.get(i.takeaway_id) ?? [];
    list.push({
      menuItemId: i.menu_item_id,
      itemName: i.item_name,
      quantity: i.quantity,
      isHalf: i.is_half,
      menuPrice: i.menu_price,
      lineTotal: i.line_total,
    });
    itemsById.set(i.takeaway_id, list);
  }
  return rows.map((r) => {
    const items = itemsById.get(r.id) ?? [];
    return {
      id: r.id,
      staffName: r.staff_name,
      takeawayDate: r.takeaway_date,
      note: r.note,
      items,
      pieces: items.reduce((sum, i) => sum + i.quantity, 0),
      menuValue: r.menu_value,
      discountPct: r.discount_pct,
      amountOwed: r.amount_owed,
      createdByName: r.created_by_name,
      createdAt: r.created_at.toISOString(),
      updatedByName: r.updated_by_name,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
    };
  });
}

async function getTakeaway(id: number): Promise<StaffTakeaway | null> {
  const rows = await query<TakeawayRow>(`${SELECT_TAKEAWAYS} WHERE st.id = $1`, [id]);
  return (await withItems(rows))[0] ?? null;
}

/**
 * Prices a takeaway's items: menu price as an order would charge it, then the
 * staff discount. Only momos can be taken; the discount is fixed at the time
 * of recording and stored, so changing it later does not rewrite history.
 */
function priceTakeaway(input: StaffTakeawayInput) {
  const staffName = normalizeText(input.staffName);
  if (!staffName) throw Object.assign(new Error('Staff name is required'), { status: 400 });
  if (input.items.length === 0) throw Object.assign(new Error('Add at least one item'), { status: 400 });

  const factor = (100 - STAFF_TAKEAWAY_DISCOUNT_PCT) / 100;
  const lines = input.items.map((item) => {
    const menuItem = menu.find((m) => m.id === item.menuItemId);
    if (!menuItem || menuItem.isBeverage) {
      throw Object.assign(new Error(`Menu item ${item.menuItemId} is not a momo`), { status: 400 });
    }
    const { lineTotal: menuPrice } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
    return {
      ...item,
      itemName: menuItem.displayName,
      menuPrice,
      lineTotal: roundMoney(menuPrice * factor),
    };
  });
  return {
    staffName,
    takeawayDate: input.takeawayDate,
    note: normalizeText(input.note),
    lines,
    menuValue: roundMoney(lines.reduce((s, l) => s + l.menuPrice, 0)),
    amountOwed: roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0)),
  };
}

async function insertItems(client: PoolClient, takeawayId: number, lines: ReturnType<typeof priceTakeaway>['lines']) {
  for (const l of lines) {
    await client.query(
      `INSERT INTO staff_takeaway_items (takeaway_id, menu_item_id, item_name, quantity, is_half, menu_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [takeawayId, l.menuItemId, l.itemName, l.quantity, l.isHalf, l.menuPrice, l.lineTotal],
    );
  }
}

/** Record momos a staff member took, priced at the staff discount. */
export async function addTakeaway(input: StaffTakeawayInput, createdBy: number): Promise<StaffTakeaway> {
  const priced = priceTakeaway(input);
  const id = await withTransaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO staff_takeaways (staff_name, takeaway_date, note, menu_value, discount_pct, amount_owed, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [priced.staffName, priced.takeawayDate, priced.note, priced.menuValue, STAFF_TAKEAWAY_DISCOUNT_PCT, priced.amountOwed, createdBy],
    );
    await insertItems(client, inserted.rows[0].id, priced.lines);
    return inserted.rows[0].id;
  });
  return (await getTakeaway(id))!;
}

/**
 * Correct a takeaway: name, date, note or items. It is repriced at the
 * current staff discount.
 *
 * @returns the takeaway before and after, or null if it did not exist.
 */
export async function updateTakeaway(
  id: number,
  input: StaffTakeawayInput,
  updatedBy: number,
): Promise<{ before: StaffTakeaway; after: StaffTakeaway } | null> {
  const before = await getTakeaway(id);
  if (!before) return null;
  const priced = priceTakeaway(input);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE staff_takeaways
       SET staff_name = $2, takeaway_date = $3, note = $4, menu_value = $5, discount_pct = $6,
           amount_owed = $7, updated_by = $8, updated_at = NOW()
       WHERE id = $1`,
      [id, priced.staffName, priced.takeawayDate, priced.note, priced.menuValue, STAFF_TAKEAWAY_DISCOUNT_PCT, priced.amountOwed, updatedBy],
    );
    await client.query('DELETE FROM staff_takeaway_items WHERE takeaway_id = $1', [id]);
    await insertItems(client, id, priced.lines);
  });
  return { before, after: (await getTakeaway(id))! };
}

/** @returns the deleted takeaway, or null if it did not exist. */
export async function deleteTakeaway(id: number): Promise<StaffTakeaway | null> {
  const takeaway = await getTakeaway(id);
  if (!takeaway) return null;
  await query('DELETE FROM staff_takeaways WHERE id = $1', [id]);
  return takeaway;
}

/** Takeaways in a calendar month (`YYYY-MM`), newest first, with totals per person. */
export async function getTakeawayMonth(month: string): Promise<TakeawayMonthReport> {
  const rows = await query<TakeawayRow>(
    `${SELECT_TAKEAWAYS} WHERE ${IN_MONTH('st.takeaway_date')}
     ORDER BY st.takeaway_date DESC, st.created_at DESC, st.id DESC`,
    [month],
  );
  const takeaways = await withItems(rows);

  const byStaff = groupByStaff(
    takeaways,
    () => ({ count: 0, pieces: 0, menuValue: 0, amountOwed: 0 }),
    (g, t) => {
      g.count += 1;
      g.pieces += t.pieces;
      g.menuValue = roundMoney(g.menuValue + t.menuValue);
      g.amountOwed = roundMoney(g.amountOwed + t.amountOwed);
    },
  ).sort((a, b) => b.amountOwed - a.amountOwed);

  return {
    month,
    takeaways,
    byStaff,
    count: takeaways.length,
    pieces: takeaways.reduce((s, t) => s + t.pieces, 0),
    menuValue: roundMoney(takeaways.reduce((s, t) => s + t.menuValue, 0)),
    amountOwed: roundMoney(takeaways.reduce((s, t) => s + t.amountOwed, 0)),
    discountPct: STAFF_TAKEAWAY_DISCOUNT_PCT,
  };
}

/**
 * The momo items staff took on a day, for the stock screens: these left stock
 * without being sold.
 */
export async function getTakeawayItemsForDate(date: string): Promise<{ menuItemId: number; quantity: number }[]> {
  return (await query<{ menu_item_id: number; quantity: number }>(
    `SELECT i.menu_item_id, i.quantity
     FROM staff_takeaway_items i
     JOIN staff_takeaways st ON i.takeaway_id = st.id
     WHERE st.takeaway_date = $1
     ORDER BY i.id`,
    [date],
  )).map((r) => ({ menuItemId: r.menu_item_id, quantity: r.quantity }));
}

/**
 * Staff names used before, in leaves or takeaways, most recent first, to
 * suggest while typing. Spellings differing only in case count as one.
 */
export async function getStaffNames(limit = 30): Promise<string[]> {
  const rows = await query<{ staff_name: string }>(
    `SELECT staff_name FROM (
       SELECT DISTINCT ON (lower(staff_name)) staff_name, last_used
       FROM (
         SELECT staff_name, created_at AS last_used FROM staff_leaves
         UNION ALL
         SELECT staff_name, created_at FROM staff_takeaways
       ) names
       ORDER BY lower(staff_name), last_used DESC
     ) latest
     ORDER BY last_used DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.staff_name);
}
