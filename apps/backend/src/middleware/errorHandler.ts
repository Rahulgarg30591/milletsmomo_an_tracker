import { Request, Response, NextFunction } from 'express';
import { isTransientDbError } from '../db/pool.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);

  const explicitStatus = (err as any).status as number | undefined;

  if (explicitStatus && explicitStatus < 500) {
    res.status(explicitStatus).json({ error: err.message || 'Request failed' });
    return;
  }

  // Signals "retry me" to the client instead of a flat 500. Driver messages
  // carry the SQL host and port, so they never reach the response body.
  if (isTransientDbError(err)) {
    res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' });
    return;
  }

  res.status(explicitStatus || 500).json({ error: 'Internal server error' });
}
