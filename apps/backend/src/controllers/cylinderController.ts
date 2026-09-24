import { Request, Response, NextFunction } from 'express';
import {
  getCylinderRefillsSchema,
  addCylinderRefillSchema,
  updateCylinderRefillSchema,
  cylinderRefillIdSchema,
  getCylinderMonthSchema,
} from '../validators/cylinderValidators.js';
import * as cylinderService from '../services/cylinderService.js';
import type { CylinderBrand, CylinderRefill } from '../services/cylinderService.js';
import { createLog } from '../services/staffLogService.js';

const BRAND_LABELS: Record<CylinderBrand, string> = {
  HP: 'HP (Hindustan Petroleum)',
  BP: 'BP (Bharat Petroleum)',
  INDANE: 'Indane',
};

function describe(refill: CylinderRefill): string {
  const from = refill.source ? ` from ${refill.source}` : '';
  return `${BRAND_LABELS[refill.brand]} ₹${refill.amount.toFixed(2)}${from}`;
}

function snapshot(refill: CylinderRefill) {
  return { brand: refill.brand, amount: refill.amount, source: refill.source };
}

async function logRefill(
  refill: CylinderRefill,
  action: 'add' | 'update' | 'delete',
  userId: number,
  before?: CylinderRefill,
): Promise<void> {
  const details = {
    add: `Cylinder refill logged: ${describe(refill)}`,
    update: `Cylinder refill edited: ${before ? describe(before) : ''} → ${describe(refill)}`,
    delete: `Cylinder refill deleted: ${describe(refill)}`,
  }[action].slice(0, 500);
  try {
    await createLog(refill.refillDate, 'cylinder_refill', userId, details, {
      action,
      refillId: refill.id,
      refillDate: refill.refillDate,
      ...snapshot(refill),
      ...(before && { before: snapshot(before) }),
    });
  } catch {
    // Log failure should not block the refill itself
  }
}

export async function getRefills(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date } = getCylinderRefillsSchema.parse(req.query);
    const refills = await cylinderService.getRefillsForDate(date);
    res.json({ date, refills });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function addRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refillDate, ...input } = addCylinderRefillSchema.parse(req.body);
    const userId = req.user!.id;
    const refill = await cylinderService.addRefill(refillDate, input, userId);
    await logRefill(refill, 'add', userId);
    res.status(201).json(refill);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function updateRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = cylinderRefillIdSchema.parse(req.params);
    const input = updateCylinderRefillSchema.parse(req.body);
    const userId = req.user!.id;
    const result = await cylinderService.updateRefill(id, input, userId);
    if (!result) {
      res.status(404).json({ error: 'Cylinder refill not found' });
      return;
    }
    await logRefill(result.after, 'update', userId, result.before);
    res.json(result.after);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function getSources(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ sources: await cylinderService.getRecentSources() });
  } catch (err) {
    next(err);
  }
}

export async function deleteRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = cylinderRefillIdSchema.parse(req.params);
    const userId = req.user!.id;
    const refill = await cylinderService.deleteRefill(id);
    if (!refill) {
      res.status(404).json({ error: 'Cylinder refill not found' });
      return;
    }
    await logRefill(refill, 'delete', userId);
    res.json(refill);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid refill id' });
      return;
    }
    next(err);
  }
}

export async function getMonthReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month } = getCylinderMonthSchema.parse(req.query);
    res.json(await cylinderService.getMonthReport(month));
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
      return;
    }
    next(err);
  }
}
