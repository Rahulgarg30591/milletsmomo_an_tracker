import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again after 60 seconds.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});