import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getSupplyVerificationSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const createSupplyVerificationSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  items: z.array(
    z.object({
      supplyItemId: z.number().int().positive(),
      expectedQty: z.number().int().min(0),
      actualQty: z.number().int().min(0),
    }),
  ).min(1, 'At least one item is required'),
});
