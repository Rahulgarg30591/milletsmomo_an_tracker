import { Request, Response, NextFunction } from 'express';
import { createSupplyOrderSchema, getSupplyOrderSchema } from '../validators/supplyValidators.js';
import * as supplyService from '../services/supplyService.js';

export async function getItems(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const items = await supplyService.getSupplyItems();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getSupplyOrderSchema.parse(req.query);
    const order = await supplyService.getSupplyOrder(date);
    res.json(order || { items: [], totalCost: 0, orderDate: date });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const date = req.query.date as string;
    const endDate = req.query.endDate as string | undefined;
    if (!date) {
      res.status(400).json({ error: 'Missing date parameter' });
      return;
    }
    const end = endDate || date;
    const orders = await supplyService.listSupplyOrders(date, end);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = getSupplyOrderSchema.parse(req.query);
    const logs = await supplyService.getSupplyOrderLogs(date);
    res.json(logs);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    next(err);
  }
}

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderDate, items } = createSupplyOrderSchema.parse(req.body);
    const userId = req.user!.id;
    const order = await supplyService.createSupplyOrder(orderDate, items, userId);
    res.status(201).json(order);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}

export async function upsertOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { orderDate, items } = createSupplyOrderSchema.parse(req.body);
    const userId = req.user!.id;
    const order = await supplyService.updateSupplyOrder(orderDate, items, userId);
    res.json(order);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}