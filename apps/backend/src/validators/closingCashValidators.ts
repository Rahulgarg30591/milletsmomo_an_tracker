import { z } from 'zod';
import { dateRegex } from './common.js';

export const getClosingCashSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const saveClosingCashSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  amount: z.number().min(0).max(1_000_000),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});
