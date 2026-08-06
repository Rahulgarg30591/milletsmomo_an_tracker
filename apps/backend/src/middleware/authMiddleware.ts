import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/simpleToken.js';

export interface AuthUser {
  id: number;
  role: string;
  displayName: string;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Azure SWA injects its own Authorization header when proxying to managed functions,
  // so we use a custom header to carry the user's signed token instead.
  const customToken = req.headers['x-auth-token'] as string | undefined;
  if (!customToken) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }

  const token = customToken;
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.user = {
    id: Number(decoded.sub),
    role: decoded.role,
    displayName: decoded.displayName,
  };
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
