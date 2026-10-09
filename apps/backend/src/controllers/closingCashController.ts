import { Request, Response, NextFunction } from 'express';
import { getClosingCashSchema, saveClosingCashSchema } from '../validators/closingCashValidators.js';
import * as closingCashService from '../services/closingCashService.js';
import * as staffLogService from '../services/staffLogService.js';
import { notifyAdmins, isStaffActor } from '../services/notificationService.js';

/** Staff get the recorded amount only; admin also get expected cash and the difference. */
export async function getClosingCash(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date } = getClosingCashSchema.parse(req.query);
    const result = req.user?.role === 'admin'
      ? await closingCashService.getClosingCashReview(date)
      : await closingCashService.getClosingCash(date);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

/** Records the cash counted at close. */
export async function saveClosingCash(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderDate, amount } = saveClosingCashSchema.parse(req.body);
    const user = req.user!;
    const result = await closingCashService.saveClosingCash(orderDate, amount, user.id);

    try {
      await staffLogService.createLog(orderDate, 'closing_cash', user.id, `Recorded closing cash ₹${amount}`, { orderDate, amount });
    } catch {
      // Log failure should not block the save
    }
    if (isStaffActor(user.role)) {
      await notifyAdmins({
        title: 'Closing cash saved',
        body: `${user.displayName} counted ₹${amount} for ${orderDate}`,
        url: `/admin/closing-stock?date=${orderDate}`,
        tag: `closing-cash-${orderDate}`,
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Enter a cash amount of ₹0 or more' });
      return;
    }
    next(err);
  }
}
