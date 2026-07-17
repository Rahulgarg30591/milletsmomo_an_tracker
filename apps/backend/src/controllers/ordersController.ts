import { Request, Response, NextFunction } from 'express';
import { dateQuerySchema, createOrderSchema, completeOrderSchema, updateOrderSchema } from '../validators/orderValidators.js';
import * as ordersService from '../services/ordersService.js';
import * as staffLogService from '../services/staffLogService.js';

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = dateQuerySchema.parse(req.query);
    const result = await ordersService.getOrders(date);
    res.json(result);
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
    const data = createOrderSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await ordersService.createOrder(userId, data);

    const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);
    let paymentDetails: string = data.paymentMethod;
    if (data.paymentMethod === 'split') {
      paymentDetails = `split (₹${data.cashAmount} cash + ₹${data.upiAmount} upi)`;
    }
    const details = `Order #${result.id} created: ${totalItems} items, ₹${result.totalAmount.toFixed(2)}, ${paymentDetails}`;
    await staffLogService.createLog(data.orderDate, 'order_create', userId, details, {
      orderId: result.id,
      itemCount: totalItems,
      totalAmount: Number(result.totalAmount),
      paymentMethod: data.paymentMethod,
      cashAmount: data.cashAmount,
      upiAmount: data.upiAmount,
      orderType: data.orderType,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid order data' });
      return;
    }
    next(err);
  }
}

export async function completeOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const body = completeOrderSchema.safeParse(req.body);
    const paymentMethod = body.success ? body.data.paymentMethod : undefined;
    const cashAmount = body.success ? body.data.cashAmount : undefined;
    const upiAmount = body.success ? body.data.upiAmount : undefined;
    const result = await ordersService.completeOrder(id, paymentMethod, cashAmount, upiAmount);

    const userId = req.user?.id;
    if (userId) {
      const pay = result.paymentMethod;
      const payDetails = pay === 'split' ? `split (₹${result.cashAmount} cash + ₹${result.upiAmount} upi)` : pay;
      const details = `Order #${id} completed: ${payDetails}`;
      await staffLogService.createLog(result.orderDate, 'order_complete', userId, details, {
        orderId: id,
        paymentMethod: result.paymentMethod,
        cashAmount: result.cashAmount,
        upiAmount: result.upiAmount,
        totalAmount: result.totalAmount,
      });
    }

    res.json(result);
  } catch (err: any) {
    next(err);
  }
}

export async function deleteOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const result = await ordersService.deleteOrder(id);

    const userId = req.user?.id;
    if (userId) {
      const details = `Order #${id} deleted`;
      await staffLogService.createLog(result.orderDate, 'order_delete', userId, details, {
        orderId: id,
      });
    }

    res.json(result);
  } catch (err: any) {
    next(err);
  }
}

export async function updateOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const data = updateOrderSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await ordersService.updateOrder(id, data);

    const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);
    let paymentDetails: string = data.paymentMethod;
    if (data.paymentMethod === 'split') {
      paymentDetails = `split (₹${data.cashAmount} cash + ₹${data.upiAmount} upi)`;
    }
    const details = `Order #${id} updated: ${totalItems} items, ₹${result.totalAmount.toFixed(2)}, ${paymentDetails}`;
    await staffLogService.createLog(result.orderDate, 'order_update', userId, details, {
      orderId: id,
      itemCount: totalItems,
      totalAmount: Number(result.totalAmount),
      paymentMethod: data.paymentMethod,
      cashAmount: data.cashAmount,
      upiAmount: data.upiAmount,
      orderType: data.orderType,
    });

    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid order data' });
      return;
    }
    next(err);
  }
}