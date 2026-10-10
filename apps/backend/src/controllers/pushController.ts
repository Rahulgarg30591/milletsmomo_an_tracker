import { Request, Response, NextFunction } from 'express';
import { pushSubscriptionSchema, pushUnsubscribeSchema } from '../validators/closingCashValidators.js';
import * as notificationService from '../services/notificationService.js';

/** The VAPID public key; publicKey is null when the server has push turned off. */
export function getPublicKey(_req: Request, res: Response): void {
  res.json({ publicKey: notificationService.getPublicKey() });
}

/** Registers this admin device for notifications. */
export async function subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sub = pushSubscriptionSchema.parse(req.body);
    await notificationService.saveSubscription(sub, req.user!.id);
    res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid subscription' });
      return;
    }
    next(err);
  }
}

/** Stops notifications to this device. */
export async function unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endpoint } = pushUnsubscribeSchema.parse(req.body);
    await notificationService.deleteSubscription(endpoint);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid subscription' });
      return;
    }
    next(err);
  }
}

/** Sends a test notification to this device and reports the result. */
export async function sendTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endpoint } = pushUnsubscribeSchema.parse(req.body);
    res.json(await notificationService.sendTest(endpoint));
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid subscription' });
      return;
    }
    next(err);
  }
}
