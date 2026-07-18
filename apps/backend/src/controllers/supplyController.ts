import { Request, Response, NextFunction } from 'express';
import { createSupplyOrderSchema, getSupplyOrderSchema } from '../validators/supplyValidators.js';
import * as supplyService from '../services/supplyService.js';
import * as staffLogService from '../services/staffLogService.js';

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

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const details = `Supply order created for ${orderDate}: ${items.length} items, ₹${order.totalCost.toFixed(2)}`;
    try {
      await staffLogService.createLog(orderDate, 'supply_order', userId, details, {
        supplyOrderId: order.id,
        orderDate,
        itemCount: items.length,
        totalQuantity: totalItems,
        totalCost: Number(order.totalCost),
        action: 'create',
      });
    } catch {
      // Log failure should not block supply order creation
    }

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

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const details = `Supply order updated for ${orderDate}: ${items.length} items, ₹${order.totalCost.toFixed(2)}`;
    try {
      await staffLogService.createLog(orderDate, 'supply_order', userId, details, {
        supplyOrderId: order.id,
        orderDate,
        itemCount: items.length,
        totalQuantity: totalItems,
        totalCost: Number(order.totalCost),
        action: 'update',
      });
    } catch {
      // Log failure should not block supply order update
    }

    res.json(order);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    next(err);
  }
}