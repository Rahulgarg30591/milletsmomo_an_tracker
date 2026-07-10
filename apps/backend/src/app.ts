import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { getPool } from './db/pool.js';
import authRoutes from './routes/authRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import ordersRoutes from './routes/ordersRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import supplyRoutes from './routes/supplyRoutes.js';
import clientLogRoutes from './routes/clientLogRoutes.js';
import paymentSettlementRoutes from './routes/paymentSettlementRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import { globalLimiter } from './middleware/rateLimiter.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", ...allowedOrigins],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
    if (isLocalhost || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '50kb' }));

app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  skip: (_req, _res) => false,
}));

app.use(globalLimiter);

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/supply', supplyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client-logs', clientLogRoutes);
app.use('/api/admin', paymentSettlementRoutes);
app.use('/api/expenses', expenseRoutes);

app.use(errorHandler);

export default app;