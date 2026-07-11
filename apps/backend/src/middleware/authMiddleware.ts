import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

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
  // so we use a custom header to carry the user's JWT instead.
  const customToken = req.headers['x-auth-token'] as string | undefined;
  if (!customToken) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }

  const token = customToken;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: Number(decoded.sub),
      role: decoded.role,
      displayName: decoded.displayName,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
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
