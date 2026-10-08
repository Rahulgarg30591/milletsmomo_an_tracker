import { z } from 'zod';
import { dateRegex } from './common.js';

const supplyItemSchema = z.object({
  supplyItemId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

export const createSupplyOrderSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  items: z.array(supplyItemSchema).min(1, 'At least one item is required'),
});

export const getSupplyOrderSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const noSupplySchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});