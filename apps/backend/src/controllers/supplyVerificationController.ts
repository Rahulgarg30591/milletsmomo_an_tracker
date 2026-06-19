import { Request, Response, NextFunction } from 'express';
import { getSupplyVerificationSchema, createSupplyVerificationSchema } from '../validators/supplyVerificationValidators.js';
import * as supplyVerificationService from '../services/supplyVerificationService.js';

export async function getVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getSupplyVerificationSchema.parse(req.query);
    const verification = await supplyVerificationService.getVerification(date);
    if (!verification) {
      res.json({ items: [], isFullyVerified: false, conflictCount: 0, orderDate: date });
      return;
    }
    res.json(verification);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function createVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderDate, items } = createSupplyVerificationSchema.parse(req.body);
    const userId = req.user!.id;
    const verification = await supplyVerificationService.createVerification(
      orderDate,
      items.map((i) => ({
        supplyItemId: i.supplyItemId,
        expectedQty: i.expectedQty,
        actualQty: i.actualQty,
      })),
      userId,
    );
    res.status(201).json(verification);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}
