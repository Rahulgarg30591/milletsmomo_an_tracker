import { Request, Response, NextFunction } from 'express';
import { staffLeaveSchema, staffMonthSchema, staffIdSchema, staffTakeawaySchema, staffDateSchema } from '../validators/staffValidators.js';
import * as staffService from '../services/staffService.js';
import type { StaffLeave, StaffTakeaway } from '../services/staffService.js';
import { createLog } from '../services/staffLogService.js';

function describe(leave: StaffLeave): string {
  return `${leave.staffName} on ${leave.leaveDate}${leave.reason ? ` (${leave.reason})` : ''}`;
}

function snapshot(leave: StaffLeave) {
  return { staffName: leave.staffName, leaveDate: leave.leaveDate, reason: leave.reason };
}

async function logLeave(
  leave: StaffLeave,
  action: 'add' | 'update' | 'delete',
  userId: number,
  before?: StaffLeave,
): Promise<void> {
  const details = {
    add: `Marked absent: ${describe(leave)}`,
    update: `Leave edited: ${before ? describe(before) : ''} → ${describe(leave)}`,
    delete: `Leave removed: ${describe(leave)}`,
  }[action].slice(0, 500);
  try {
    await createLog(leave.leaveDate, 'staff_leave', userId, details, {
      action,
      leaveId: leave.id,
      ...snapshot(leave),
      ...(before && { before: snapshot(before) }),
    });
  } catch {
    // Log failure should not block the leave itself
  }
}

/** Zod errors are 400s; service errors carry their own status (409 for a duplicate). */
function handleError(err: any, res: Response, next: NextFunction, zodMessage: string): void {
  if (err.name === 'ZodError') {
    res.status(400).json({ error: err.errors?.[0]?.message ?? zodMessage, details: err.errors });
    return;
  }
  if (err.status && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  next(err);
}

export async function getLeaves(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month } = staffMonthSchema.parse(req.query);
    res.json(await staffService.getLeaveMonth(month));
  } catch (err: any) {
    handleError(err, res, next, 'Invalid month format. Use YYYY-MM.');
  }
}

export async function addLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = staffLeaveSchema.parse(req.body);
    const userId = req.user!.id;
    const leave = await staffService.addLeave(input, userId);
    await logLeave(leave, 'add', userId);
    res.status(201).json(leave);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid input');
  }
}

export async function updateLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = staffIdSchema.parse(req.params);
    const input = staffLeaveSchema.parse(req.body);
    const userId = req.user!.id;
    const result = await staffService.updateLeave(id, input, userId);
    if (!result) {
      res.status(404).json({ error: 'Leave not found' });
      return;
    }
    await logLeave(result.after, 'update', userId, result.before);
    res.json(result.after);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid input');
  }
}

export async function deleteLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = staffIdSchema.parse(req.params);
    const userId = req.user!.id;
    const leave = await staffService.deleteLeave(id);
    if (!leave) {
      res.status(404).json({ error: 'Leave not found' });
      return;
    }
    await logLeave(leave, 'delete', userId);
    res.json(leave);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid leave id');
  }
}

function describeTakeaway(t: StaffTakeaway): string {
  return `${t.staffName} on ${t.takeawayDate}: ${t.items.length} item(s), ₹${t.amountOwed.toFixed(2)} owed (${t.discountPct}% off ₹${t.menuValue.toFixed(2)})`;
}

function takeawaySnapshot(t: StaffTakeaway) {
  return {
    staffName: t.staffName,
    takeawayDate: t.takeawayDate,
    amountOwed: t.amountOwed,
    menuValue: t.menuValue,
    items: t.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, isHalf: i.isHalf })),
  };
}

async function logTakeaway(
  t: StaffTakeaway,
  action: 'add' | 'update' | 'delete',
  userId: number,
  before?: StaffTakeaway,
): Promise<void> {
  const details = {
    add: `Staff takeaway logged: ${describeTakeaway(t)}`,
    update: `Staff takeaway edited: ${describeTakeaway(t)}`,
    delete: `Staff takeaway removed: ${describeTakeaway(t)}`,
  }[action].slice(0, 500);
  try {
    await createLog(t.takeawayDate, 'staff_takeaway', userId, details, {
      action,
      takeawayId: t.id,
      ...takeawaySnapshot(t),
      ...(before && { before: takeawaySnapshot(before) }),
    });
  } catch {
    // Log failure should not block the takeaway itself
  }
}

export async function addTakeaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = staffTakeawaySchema.parse(req.body);
    const userId = req.user!.id;
    const takeaway = await staffService.addTakeaway(input, userId);
    await logTakeaway(takeaway, 'add', userId);
    res.status(201).json(takeaway);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid input');
  }
}

export async function updateTakeaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = staffIdSchema.parse(req.params);
    const input = staffTakeawaySchema.parse(req.body);
    const userId = req.user!.id;
    const result = await staffService.updateTakeaway(id, input, userId);
    if (!result) {
      res.status(404).json({ error: 'Takeaway not found' });
      return;
    }
    await logTakeaway(result.after, 'update', userId, result.before);
    res.json(result.after);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid input');
  }
}

export async function deleteTakeaway(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = staffIdSchema.parse(req.params);
    const userId = req.user!.id;
    const takeaway = await staffService.deleteTakeaway(id);
    if (!takeaway) {
      res.status(404).json({ error: 'Takeaway not found' });
      return;
    }
    await logTakeaway(takeaway, 'delete', userId);
    res.json(takeaway);
  } catch (err: any) {
    handleError(err, res, next, 'Invalid takeaway id');
  }
}

/** The day's takeaway items, for stock screens. Readable by any signed-in user. */
export async function getTakeawayItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date } = staffDateSchema.parse(req.query);
    res.json({ date, items: await staffService.getTakeawayItemsForDate(date) });
  } catch (err: any) {
    handleError(err, res, next, 'Invalid date format. Use YYYY-MM-DD.');
  }
}

export async function getTakeaways(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month } = staffMonthSchema.parse(req.query);
    res.json(await staffService.getTakeawayMonth(month));
  } catch (err: any) {
    handleError(err, res, next, 'Invalid month format. Use YYYY-MM.');
  }
}

export async function getStaffNames(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ names: await staffService.getStaffNames() });
  } catch (err) {
    next(err);
  }
}
