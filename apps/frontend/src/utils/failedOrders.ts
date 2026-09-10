import { useSyncExternalStore } from 'react';

export interface FailedOrder {
  id: string;
  kind: 'create' | 'update';
  /** Present for updates: the order being edited. */
  orderId?: number;
  orderDate: string;
  totalAmount: number;
  /** Human-readable line list, so staff can recognise which order failed. */
  summary: string;
  /** The exact request body, replayed verbatim on retry. */
  payload: Record<string, unknown>;
  failedAt: number;
}

const STORAGE_KEY = 'mm_failed_orders';
const listeners = new Set<() => void>();

/**
 * Cached so `getSnapshot` returns a stable reference between changes —
 * useSyncExternalStore loops forever if handed a fresh array every call.
 */
let snapshot: FailedOrder[] = load();

function load(): FailedOrder[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function commit(next: FailedOrder[]): void {
  snapshot = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or unavailable store must not lose the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Records an order the server rejected.
 *
 * Orders are submitted optimistically — the draft is cleared and the day view
 * opens before the server answers, which keeps entry fast on a slow
 * connection. Without this, a rejected order vanished with only a toast that
 * auto-dismissed, and the staff lost the order entirely.
 */
export function addFailedOrder(order: Omit<FailedOrder, 'id' | 'failedAt'>): void {
  const entry: FailedOrder = {
    ...order,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    failedAt: Date.now(),
  };
  commit([...snapshot, entry]);
}

export function removeFailedOrder(id: string): void {
  commit(snapshot.filter((o) => o.id !== id));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FailedOrder[] {
  return snapshot;
}

/** Failed orders for a given date, newest first. */
export function useFailedOrders(orderDate?: string): FailedOrder[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!orderDate) return all;
  return all.filter((o) => o.orderDate === orderDate);
}
