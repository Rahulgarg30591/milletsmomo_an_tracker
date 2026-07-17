import { formatDateTimeIST } from './dateUtils';

export interface ClientLogEntry {
  id: string;
  timestamp: string;
  type: 'login' | 'page_view' | 'button_click' | 'form_submit' | 'action_start' | 'action_end' | 'order_submit' | 'order_complete' | 'verification_submit' | 'closing_stock_submit' | 'navigation' | 'logout' | 'revenue_check' | 'selection' | 'quantity_change';
  page: string;
  details: string;
  metadata?: Record<string, any>;
  userId?: number;
  userRole?: string;
  deviceInfo?: string;
  durationMs?: number;
}

const LOG_KEY = 'mm_activity_logs';
const LAST_FLUSH_KEY = 'mm_last_flush';
const SESSION_START_KEY = 'mm_session_start';
const SESSION_ID_KEY = 'mm_session_id';
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const dpr = window.devicePixelRatio;
  return `Platform: ${platform}, Screen: ${screen}@${dpr}, UA: ${ua.slice(0, 100)}`;
}

// Cached for the session — device never changes mid-session.
let cachedDeviceInfo: string | null = null;
function getDeviceInfoCached(): string {
  if (!cachedDeviceInfo) cachedDeviceInfo = getDeviceInfo();
  return cachedDeviceInfo;
}

// User info recomputed only when the token changes (login/logout).
let cachedUserInfo: { userId?: number; userRole?: string } | null = null;
let cachedUserInfoToken: string | null | undefined;
function getUserInfoCached(): { userId?: number; userRole?: string } {
  const token = localStorage.getItem('token');
  if (token !== cachedUserInfoToken) {
    cachedUserInfoToken = token;
    cachedUserInfo = getUserInfo();
  }
  return cachedUserInfo || {};
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStoredLogs(): ClientLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredLogs(logs: ClientLogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function getUserInfo(): { userId?: number; userRole?: string } {
  try {
    const token = localStorage.getItem('token');
    if (!token) return {};
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.id, userRole: payload.role };
  } catch {
    return {};
  }
}

function getLastFlushTime(): number {
  try {
    const raw = localStorage.getItem(LAST_FLUSH_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function setLastFlushTime() {
  localStorage.setItem(LAST_FLUSH_KEY, String(Date.now()));
}

function shouldFlush(): boolean {
  const logs = getStoredLogs();
  if (logs.length >= BATCH_SIZE) return true;
  const lastFlush = getLastFlushTime();
  if (lastFlush === 0) return true;
  return Date.now() - lastFlush >= FLUSH_INTERVAL_MS;
}

export function addLog(entry: Omit<ClientLogEntry, 'id' | 'timestamp' | 'deviceInfo' | 'userId' | 'userRole'>) {
  const logs = getStoredLogs();
  if (logs.length >= BATCH_SIZE || Date.now() - getLastFlushTime() >= FLUSH_INTERVAL_MS || getLastFlushTime() === 0) {
    flushLogs();
    logs.length = 0;
  }

  const userInfo = getUserInfoCached();
  const newEntry: ClientLogEntry = {
    id: generateId(),
    timestamp: formatDateTimeIST(),
    deviceInfo: getDeviceInfoCached(),
    userId: userInfo.userId,
    userRole: userInfo.userRole,
    ...entry,
    metadata: { sessionId: getSessionId(), ...entry.metadata },
  };
  logs.push(newEntry);
  setStoredLogs(logs);

  if (logs.length >= BATCH_SIZE) {
    flushLogs();
  }
}

export function flushLogs(): Promise<ClientLogEntry[]> {
  const logs = getStoredLogs();
  if (logs.length === 0) return Promise.resolve([]);

  const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Auth-Token'] = token;

  const promise = fetch(`${apiUrl}/client-logs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ logs }),
    keepalive: true,
  })
    .then(() => {
      setStoredLogs([]);
      setLastFlushTime();
      return logs;
    })
    .catch(() => {
      // Silently fail - logs remain in localStorage
      return [];
    });

  return promise;
}

// Set up periodic flush every 30 minutes
setInterval(() => {
  if (shouldFlush()) {
    flushLogs();
  }
}, 60 * 1000); // Check every minute

export function getLogs(): ClientLogEntry[] {
  return getStoredLogs();
}

export function clearLogs() {
  localStorage.removeItem(LOG_KEY);
}

// Session tracking

export function markSessionStart() {
  sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
  sessionStorage.removeItem(SESSION_ID_KEY);
}

export function getSessionDurationMs(): number | undefined {
  const start = sessionStorage.getItem(SESSION_START_KEY);
  if (!start) return undefined;
  return Date.now() - parseInt(start, 10);
}

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    const start = sessionStorage.getItem(SESSION_START_KEY) || String(Date.now());
    if (!sessionStorage.getItem(SESSION_START_KEY)) {
      sessionStorage.setItem(SESSION_START_KEY, start);
    }
    id = `s-${start}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

// Trackers
export function trackLogin(metadata?: Record<string, any>) {
  addLog({ type: 'login', page: 'login', details: 'User logged in', metadata: { url: window.location.href, device: getDeviceInfo(), ...metadata } });
}

export function trackPageView(page: string, details?: string) {
  addLog({ type: 'page_view', page, details: details || `Viewed ${page}`, metadata: { url: window.location.href } });
}

export function trackButtonClick(page: string, buttonName: string, metadata?: Record<string, any>) {
  addLog({ type: 'button_click', page, details: `Clicked: ${buttonName}`, metadata });
}

export function trackActionStart(page: string, action: string, metadata?: Record<string, any>) {
  addLog({ type: 'action_start', page, details: `Started: ${action}`, metadata: { actionId: generateId(), ...metadata } });
}

export function trackActionEnd(page: string, action: string, actionId: string, metadata?: Record<string, any>) {
  const logs = getStoredLogs();
  const startEntry = logs.find((l) => l.metadata?.actionId === actionId && l.type === 'action_start');
  const durationMs = startEntry ? Date.now() - new Date(startEntry.timestamp).getTime() : undefined;
  addLog({ type: 'action_end', page, details: `Completed: ${action}`, durationMs, metadata: { actionId, ...metadata } });
}

export function trackNavigation(from: string, to: string, metadata?: Record<string, any>) {
  addLog({ type: 'navigation', page: to, details: `Navigated from ${from} to ${to}`, metadata: { from, ...metadata } });
  flushLogs();
}

export function trackOrderSubmit(orderId: number, metadata?: Record<string, any>) {
  addLog({ type: 'order_submit', page: 'new_order', details: `Order submitted: #${orderId}`, metadata });
  flushLogs();
}

export function trackOrderComplete(orderId: number, metadata?: Record<string, any>) {
  addLog({ type: 'order_complete', page: 'day_view', details: `Order completed: #${orderId}`, metadata });
  flushLogs();
}

export function trackVerificationSubmit(orderDate: string, metadata?: Record<string, any>) {
  addLog({ type: 'verification_submit', page: 'supply_verification', details: `Verification submitted for ${orderDate}`, metadata });
  flushLogs();
}

export function trackClosingStockSubmit(orderDate: string, metadata?: Record<string, any>) {
  addLog({ type: 'closing_stock_submit', page: 'closing_stock', details: `Closing stock submitted for ${orderDate}`, metadata });
  flushLogs();
}

export function trackFormSubmit(page: string, formName: string, metadata?: Record<string, any>) {
  addLog({ type: 'form_submit', page, details: `Form submitted: ${formName}`, metadata });
}

export function trackRevenueCheck(orderDate: string, metadata?: Record<string, any>) {
  addLog({ type: 'revenue_check', page: 'day_view', details: `Checked revenue for ${orderDate}`, metadata });
  flushLogs();
}

export function trackLogout(metadata?: Record<string, any>) {
  const durationMs = getSessionDurationMs();
  addLog({ type: 'logout', page: 'logout', details: 'User logged out', metadata: { url: window.location.href, device: getDeviceInfo(), sessionDurationMs: durationMs, ...metadata } });
  flushLogs();
}

export function trackSelection(page: string, field: string, value: string, metadata?: Record<string, any>) {
  addLog({ type: 'selection', page, details: `Selected ${field}: ${value}`, metadata: { field, value, ...metadata } });
}

export function trackQuantityChange(page: string, itemName: string, newQty: number, isHalf: boolean, metadata?: Record<string, any>) {
  const size = isHalf ? 'half' : 'full';
  addLog({ type: 'quantity_change', page, details: `Set ${itemName} to ${newQty} (${size})`, metadata: { itemName, quantity: newQty, isHalf, ...metadata } });
}

// Send remaining logs on page unload
window.addEventListener('beforeunload', () => {
  const logs = getStoredLogs();
  if (logs.length > 0) {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-Auth-Token'] = token;
    fetch(`${apiUrl}/client-logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs }),
      keepalive: true,
    }).catch(() => {});
    setLastFlushTime();
  }
});
