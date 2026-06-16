import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getPool } from '../db/pool.js';

const JWT_SECRET = process.env.JWT_SECRET || '';

export interface LoginResult {
  token: string;
  role: string;
  displayName: string;
  expiresIn: number;
}

export async function login(
  role: string,
  pin: string,
): Promise<LoginResult> {
  const pool = await getPool();
  const request = pool.request();
  request.input('role', sql.NVarChar, role);

  const result = await request.query(
    'SELECT id, username, role, pin_hash, display_name FROM Users WHERE role = @role AND is_active = 1',
  );

  if (result.recordset.length === 0) {
    throw Object.assign(new Error('Invalid PIN'), { status: 401 });
  }

  const user = result.recordset[0];
  const valid = await bcrypt.compare(pin, user.pin_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid PIN'), { status: 401 });
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.role, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: '12h' as const },
  );

  return {
    token,
    role: user.role,
    displayName: user.display_name,
    expiresIn: 43200,
  };
}
