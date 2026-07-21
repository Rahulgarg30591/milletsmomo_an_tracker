import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getPool } from '../db/pool.js';

const JWT_SECRET = process.env.JWT_SECRET || '';

export interface LoginResult {
  token: string;
  userId: number;
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

  let user: { id: number; username: string; role: string; pin_hash: string; display_name: string } | null = null;
  for (const row of result.recordset) {
    if (await bcrypt.compare(pin, row.pin_hash)) {
      user = row;
      break;
    }
  }
  if (!user) {
    throw Object.assign(new Error('Invalid PIN'), { status: 401 });
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.role, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: '12h' as const },
  );

  return {
    token,
    userId: user.id,
    role: user.role,
    displayName: user.display_name,
    expiresIn: 43200,
  };
}
