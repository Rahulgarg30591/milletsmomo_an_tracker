import { z } from 'zod';

export const loginSchema = z.object({
  role: z.enum(['staff', 'admin']),
  pin: z.string().length(4).regex(/^\d{4}$/),
});
