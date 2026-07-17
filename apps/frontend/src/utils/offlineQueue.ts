import { client } from '../api/client';
import { queryClient } from '../api/queryClient';

const DB_NAME = 'mm_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

const URL_QUERY_PREFIXES: { pattern: RegExp; keys: string[][] }[] = [
  { pattern: /^\/orders/, keys: [['orders']] },
  { pattern: /^\/admin\/staff-logs/, keys: [['staffLogs']] },
  { pattern: /^\/admin\/summary/, keys: [['adminSummary']] },
  { pattern: /^\/admin\/orders/, keys: [['adminOrders']] },
  { pattern: /^\/admin\/supply/, keys: [['supplyOrders'], ['supplyVerification'], ['supplyLogs']] },
  { pattern: /^\/supply/, keys: [['supplyOrders'], ['supplyVerification'], ['supplyLogs']] },
  { pattern: /^\/closing-stock/, keys: [['closingStock']] },
];

function invalidateForUrl(url: string) {
  for (const entry of URL_QUERY_PREFIXES) {
    if (entry.pattern.test(url)) {
      for (const key of entry.keys) queryClient.invalidateQueries({ queryKey: key });
    }
  }
}

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
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Auth-Token'] = token;

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
      invalidateForUrl(mutation.url);
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

let flushInFlight = false;

export function setupOfflineSync(): () => void {
  const handleOnline = () => {
    flushOfflineQueue();
  };
  window.addEventListener('online', handleOnline);
  const interval = setInterval(() => {
    if (isOnline() && !flushInFlight) {
      flushInFlight = true;
      flushOfflineQueue().finally(() => {
        flushInFlight = false;
      });
    }
  }, 60_000);
  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}