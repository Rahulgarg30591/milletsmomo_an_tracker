import { client } from '../api/client';

const DB_NAME = 'mm_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

export interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function queueMutation(config: {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: unknown;
}): Promise<void> {
  const token = sessionStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const mutation: QueuedMutation = {
    id: generateId(),
    url: config.url,
    method: config.method,
    body: JSON.stringify(config.data),
    headers,
    timestamp: Date.now(),
    retryCount: 0,
  };

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(mutation);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as QueuedMutation[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateMutationRetry(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const getReq = store.get(id);
  return new Promise((resolve, reject) => {
    getReq.onsuccess = () => {
      const mutation = getReq.result as QueuedMutation | undefined;
      if (mutation) {
        mutation.retryCount = (mutation.retryCount || 0) + 1;
        store.put(mutation);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushOfflineQueue(): Promise<number> {
  const mutations = await getQueuedMutations();
  if (mutations.length === 0) return 0;

  let flushed = 0;
  for (const mutation of mutations) {
    if (mutation.retryCount >= 3) {
      await removeMutation(mutation.id);
      continue;
    }
    try {
      await client.request({
        url: mutation.url,
        method: mutation.method,
        data: JSON.parse(mutation.body),
        headers: mutation.headers,
      });
      await removeMutation(mutation.id);
      flushed++;
    } catch {
      await updateMutationRetry(mutation.id);
    }
  }
  return flushed;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function setupOfflineSync(): () => void {
  const handleOnline = () => {
    flushOfflineQueue();
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}