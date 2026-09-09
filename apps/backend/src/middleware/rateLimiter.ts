import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * `req.ip` is synthesized from `x-forwarded-for` by the Azure Functions shim
 * (`functions/api.ts`), so express's own proxy trust never applies. Reading it
 * directly keeps one key per client and silences the library's proxy checks.
 */
function clientKey(req: Request): string {
  return req.ip || 'unknown';
}

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again after 60 seconds.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  // Brute force needs failed attempts, so only those are counted. Everyone at
  // the shop shares one NAT address; counting successes locked out real staff.
  skipSuccessfulRequests: true,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  skip: (req) => req.path === '/api/health',
  validate: { trustProxy: false, xForwardedForHeader: false },
});
