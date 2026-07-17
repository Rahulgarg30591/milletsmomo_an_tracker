import { Request, Response, NextFunction } from 'express';
import { getPaymentSettlementSchema, createPaymentSettlementSchema, listPaymentSettlementsSchema } from '../validators/paymentSettlementValidators.js';
import * as paymentSettlementService from '../services/paymentSettlementService.js';
import * as staffLogService from '../services/staffLogService.js';

export async function getSettlement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getPaymentSettlementSchema.parse(req.query);
    const settlement = await paymentSettlementService.getSettlementSummary(date);
    res.json(settlement);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function createSettlement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderDate, actualCash, actualUpi, notes } = createPaymentSettlementSchema.parse(req.body);
    const userId = req.user!.id;
    const settlement = await paymentSettlementService.createSettlement(
      orderDate,
      actualCash,
      actualUpi,
      notes ?? null,
      userId,
    );

    const details = `Settlement saved for ${orderDate}: ₹${actualCash} cash, ₹${actualUpi} UPI${settlement.cashConflict || settlement.upiConflict ? ' (conflict)' : ''}`;
    await staffLogService.createLog(orderDate, 'payment_settlement', userId, details, {
      orderDate,
      actualCash,
      actualUpi,
      expectedCash: settlement.expectedCash,
      expectedUpi: settlement.expectedUpi,
      cashConflict: settlement.cashConflict,
      upiConflict: settlement.upiConflict,
      notes: notes ?? null,
    });

    res.status(201).json(settlement);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function listSettlements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { startDate, endDate } = listPaymentSettlementsSchema.parse(req.query);
    const settlements = await paymentSettlementService.listSettlements(startDate, endDate);
    res.json(settlements);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date range', details: err.errors });
      return;
    }
    next(err);
  }
}
