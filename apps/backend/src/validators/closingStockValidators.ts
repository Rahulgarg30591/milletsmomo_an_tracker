import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getClosingStockSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const createClosingStockSchema = z.object({
  orderDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  items: z.array(
    z.object({
      supplyItemId: z.number().int().positive(),
      packetsLeft: z.number().int().min(0),
      piecesLeft: z.number().int().min(0).max(23),
      wastagePieces: z.number().int().min(0).default(0),
      hasConflict: z.boolean().default(false),
      conflictReason: z.string().max(500).nullable().default(null),
    }),
  ).min(1, 'At least one item is required'),
});
