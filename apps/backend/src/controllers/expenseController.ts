import { Request, Response, NextFunction } from 'express';
import { getExpensesSchema, saveExpensesSchema } from '../validators/expenseValidators.js';
import * as expenseService from '../services/expenseService.js';
import { createLog } from '../services/staffLogService.js';
import { notifyAdmins, isStaffActor } from '../services/notificationService.js';

export async function getDayExpenses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getExpensesSchema.parse(req.query);
    const result = await expenseService.getDayExpenses(date);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid query parameters' });
      return;
    }
    next(err);
  }
}

export async function saveDayExpenses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = saveExpensesSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await expenseService.saveDayExpenses(
      data.orderDate,
      data.items,
      userId,
    );

    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    const details = `Saved ${data.items.length} expense(s), total ₹${totalAmount.toFixed(2)}`;
    try {
      await createLog(data.orderDate, 'expense_save', userId, details, {
        orderDate: data.orderDate,
        itemCount: data.items.length,
        totalAmount,
        items: data.items.map((i) => ({ description: i.description, amount: i.amount })),
      });
    } catch {
      // Log failure should not block expense save response
    }
    if (isStaffActor(req.user?.role)) {
      await notifyAdmins({
        title: 'Expenses saved',
        body: `${req.user!.displayName}: ${data.items.length} expense(s), ₹${totalAmount} (${data.orderDate})`,
        url: '/admin/expenses',
        tag: `expenses-${data.orderDate}`,
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    next(err);
  }
}
