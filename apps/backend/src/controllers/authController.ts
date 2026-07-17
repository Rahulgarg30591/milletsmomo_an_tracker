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

    try {
      await staffLogService.createLog(formatDate(getNowIST()), 'login', result.userId, `Login: ${result.role} (${result.displayName})`, {
        userId: result.userId,
        role: result.role,
        displayName: result.displayName,
      });
    } catch {
      // Log failure should not block login
    }

    res.status(200).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    next(err);
  }
}
