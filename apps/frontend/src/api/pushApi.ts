import { client } from './client';

export async function getPushPublicKey(): Promise<string | null> {
  const res = await client.get<{ publicKey: string | null }>('/push/public-key');
  return res.data.publicKey;
}

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await client.post('/push/subscription', sub);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await client.delete('/push/subscription', { data: { endpoint } });
}

export async function sendTestPush(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const res = await client.post<{ ok: boolean; error?: string }>('/push/test', { endpoint });
  return res.data;
}
