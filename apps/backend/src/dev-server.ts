import app from './app.js';
import { getPool, closePool } from './db/pool.js';

const PORT = parseInt(process.env.PORT || '7071', 10);

async function start() {
  try {
    await getPool();
    console.log('Database connected.');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Dev server running on http://localhost:${PORT}`);
  });

  process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
  });
}

start();