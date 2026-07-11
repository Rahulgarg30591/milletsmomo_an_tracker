import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = (err as any).status || 500;
  const message = err.message || 'Internal server error';

  console.error(err.stack);

  res.status(status).json({ error: message });
}
