import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { signToken } from '../utils/simpleToken.js';

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
  const rows = await query<{
    id: number;
    username: string;
    role: string;
    pin_hash: string;
    display_name: string;
  }>(
    'SELECT id, username, role, pin_hash, display_name FROM users WHERE role = $1 AND is_active = TRUE',
    [role],
  );

  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid PIN'), { status: 401 });
  }

  let user: { id: number; username: string; role: string; pin_hash: string; display_name: string } | null = null;
  for (const row of rows) {
    if (await bcrypt.compare(pin, row.pin_hash)) {
      user = row;
      break;
    }
  }
  if (!user) {
    throw Object.assign(new Error('Invalid PIN'), { status: 401 });
  }

  const token = signToken(String(user.id), user.role, user.display_name, 43200);

  return {
    token,
    userId: user.id,
    role: user.role,
    displayName: user.display_name,
    expiresIn: 43200,
  };
}
