import { Request, Response, NextFunction } from 'express';
import { loginSchema } from '../validators/authValidators.js';
import * as authService from '../services/authService.js';
import * as staffLogService from '../services/staffLogService.js';
import { formatDate, getNowIST } from '../utils/dateUtils.js';

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { role, pin } = loginSchema.parse(req.body);
    const result = await authService.login(role, pin);

    // Awaited, but bounded: the Functions host freezes the instance once the
    // handler resolves, and a query torn down mid-flight poisons the pool for
    // the next login. Audit logging must never fail or delay the login itself.
    await Promise.race([
      staffLogService.createLog(formatDate(getNowIST()), 'login', result.userId, `Login: ${result.role} (${result.displayName})`, {
        userId: result.userId,
        role: result.role,
        displayName: result.displayName,
      }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    res.status(200).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    next(err);
  }
}
