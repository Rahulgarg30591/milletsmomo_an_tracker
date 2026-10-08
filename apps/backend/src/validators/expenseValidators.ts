import { z } from 'zod';
import { dateRegex } from './common.js';

export const getExpensesSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const saveExpensesSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Description required').max(200),
        amount: z.number().positive('Amount must be positive'),
      }),
    )
    .max(50, 'Too many expense items'),
});
