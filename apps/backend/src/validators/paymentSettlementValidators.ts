import { z } from 'zod';
import { dateRegex } from './common.js';

export const getPaymentSettlementSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const createPaymentSettlementSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  actualCash: z.number().min(0),
  actualUpi: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const listPaymentSettlementsSchema = z.object({
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});
