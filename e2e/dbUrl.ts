const PORT = process.env.MOMO_DB_PORT ?? '5432';
const USER = process.env.TEST_DB_USER ?? 'momo';
const PASSWORD = process.env.TEST_DB_PASSWORD ?? 'MomoDev2024!';

export const E2E_DB_NAME = 'millets_momo_e2e';
export const E2E_DATABASE_URL =
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@localhost:${PORT}/${E2E_DB_NAME}`;
export const ADMIN_DATABASE_URL =
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@localhost:${PORT}/millets_momo`;
