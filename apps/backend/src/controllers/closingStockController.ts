import { Request, Response, NextFunction } from 'express';
import { getClosingStockSchema, createClosingStockSchema } from '../validators/closingStockValidators.js';
import * as closingStockService from '../services/closingStockService.js';
import * as staffLogService from '../services/staffLogService.js';

export async function getClosingStock(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getClosingStockSchema.parse(req.query);
    const stock = await closingStockService.getClosingStock(date);
    if (!stock) {
      res.json({ items: [], isSubmitted: false, orderDate: date });
      return;
    }
    res.json(stock);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function createClosingStock(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderDate, items } = createClosingStockSchema.parse(req.body);
    const userId = req.user!.id;
    const stock = await closingStockService.createClosingStock(
      orderDate,
      items.map((i) => ({
        supplyItemId: i.supplyItemId,
        packetsLeft: i.packetsLeft,
        piecesLeft: i.piecesLeft,
        wastagePieces: i.wastagePieces,
        hasConflict: i.hasConflict,
        conflictReason: i.conflictReason,
      })),
      userId,
    );

    const totalPackets = items.reduce((sum, i) => sum + i.packetsLeft, 0);
    const totalPieces = items.reduce((sum, i) => sum + i.piecesLeft, 0);
    const details = `Recorded closing stock: ${totalPackets} packets, ${totalPieces} pieces`;
    await staffLogService.createLog(orderDate, 'closing_stock', userId, details);

    res.status(201).json(stock);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}
