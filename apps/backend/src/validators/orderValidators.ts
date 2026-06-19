import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createOrderSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  orderType: z.enum(['dine', 'pack']),
  paymentMethod: z.enum(['cash', 'upi', 'pending']),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        isHalf: z.boolean().optional().default(false),
      }),
    )
    .min(1, 'At least one item is required'),
});

export const completeOrderSchema = z.object({
  paymentMethod: z.enum(['cash', 'upi']).optional(),
});

export const dateQuerySchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').optional(),
});
