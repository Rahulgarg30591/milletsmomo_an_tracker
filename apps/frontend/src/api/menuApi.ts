import { client } from './client';

export async function getMenu() {
  const res = await client.get('/menu');
  return res.data;
}
