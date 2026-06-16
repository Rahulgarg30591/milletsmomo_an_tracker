import { Request, Response, NextFunction } from 'express';
import * as menuService from '../services/menuService.js';

export async function getMenu(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = menuService.getMenu();
    res.json(result);
  } catch (err) {
    next(err);
  }
}