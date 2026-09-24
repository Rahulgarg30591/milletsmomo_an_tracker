import { z } from 'zod';
import { CYLINDER_BRANDS } from '../services/cylinderService.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getCylinderRefillsSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

const refillFields = {
  brand: z.enum(CYLINDER_BRANDS),
  // A refill runs to a few thousand rupees; the ceiling catches a slipped digit.
  amount: z.number().positive('Amount must be positive').max(20000, 'Amount looks too high'),
  source: z.string().max(100, 'Source is too long').nullable().default(null),
};

export const addCylinderRefillSchema = z.object({
  refillDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  ...refillFields,
});

export const updateCylinderRefillSchema = z.object(refillFields);

export const cylinderRefillIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getCylinderMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)'),
});
