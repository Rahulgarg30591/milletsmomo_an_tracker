import { Request, Response, NextFunction } from 'express';
import { dateQuerySchema } from '../validators/orderValidators.js';
import * as adminService from '../services/adminService.js';

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date, endDate } = dateQuerySchema.parse(req.query);
    const result = await adminService.getSummary(date, endDate);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date, endDate } = dateQuerySchema.parse(req.query);
    const result = await adminService.getAdminOrders(date, endDate);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}
