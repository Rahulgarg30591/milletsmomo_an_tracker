import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as staffLogService from '../services/staffLogService.js';

const getStaffLogsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['verification', 'closing_stock', 'order_create']).optional(),
});

export async function getStaffLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date, type } = getStaffLogsSchema.parse(req.query);
    const logs = await staffLogService.getLogs(date, type, 100);
    res.json({ logs });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid query parameters' });
      return;
    }
    next(err);
  }
}
