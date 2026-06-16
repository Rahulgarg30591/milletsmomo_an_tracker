import { client } from './client';
import type { LoginRequest, LoginResponse } from 'shared';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await client.post('/auth/login', data);
  return res.data;
}
