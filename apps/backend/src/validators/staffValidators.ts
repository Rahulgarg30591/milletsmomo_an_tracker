import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const staffLeaveSchema = z.object({
  staffName: z.string().trim().min(1, 'Staff name is required').max(60, 'Staff name is too long'),
  leaveDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().max(200, 'Reason is too long').nullable().default(null),
});

export const staffTakeawaySchema = z.object({
  staffName: z.string().trim().min(1, 'Staff name is required').max(60, 'Staff name is too long'),
  takeawayDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  note: z.string().max(200, 'Note is too long').nullable().default(null),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        // Pieces, as on orders. 60 is ten plates of one item.
        quantity: z.number().int().positive().max(60, 'That is more than ten plates of one item'),
        isHalf: z.boolean().default(false),
      }),
    )
    .min(1, 'Add at least one item')
    .max(20, 'Too many items'),
});

export const staffDateSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const staffMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)'),
});

export const staffIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
