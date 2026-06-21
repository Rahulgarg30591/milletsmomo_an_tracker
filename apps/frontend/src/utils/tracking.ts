export interface ClientLogEntry {
  id: string;
  timestamp: string;
  type: 'login' | 'page_view' | 'button_click' | 'form_submit' | 'action_start' | 'action_end' | 'order_submit' | 'order_complete' | 'verification_submit' | 'closing_stock_submit' | 'navigation' | 'logout';
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
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const dpr = window.devicePixelRatio;
  return `Platform: ${platform}, Screen: ${screen}@${dpr}, UA: ${ua.slice(0, 100)}`;
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
  if (shouldFlush()) {
    flushLogs();
  }

  const logs = getStoredLogs();
  const userInfo = getUserInfo();
  const newEntry: ClientLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    deviceInfo: getDeviceInfo(),
    userId: userInfo.userId,
    userRole: userInfo.userRole,
    ...entry,
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

  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const promise = fetch(`${apiUrl}/api/client-logs`, {
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
}

export function getSessionDurationMs(): number | undefined {
  const start = sessionStorage.getItem(SESSION_START_KEY);
  if (!start) return undefined;
  return Date.now() - parseInt(start, 10);
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
}

export function trackOrderSubmit(orderId: number, metadata?: Record<string, any>) {
  addLog({ type: 'order_submit', page: 'new_order', details: `Order submitted: #${orderId}`, metadata });
}

export function trackOrderComplete(orderId: number, metadata?: Record<string, any>) {
  addLog({ type: 'order_complete', page: 'day_view', details: `Order completed: #${orderId}`, metadata });
}

export function trackVerificationSubmit(orderDate: string, metadata?: Record<string, any>) {
  addLog({ type: 'verification_submit', page: 'supply_verification', details: `Verification submitted for ${orderDate}`, metadata });
}

export function trackClosingStockSubmit(orderDate: string, metadata?: Record<string, any>) {
  addLog({ type: 'closing_stock_submit', page: 'closing_stock', details: `Closing stock submitted for ${orderDate}`, metadata });
}

export function trackFormSubmit(page: string, formName: string, metadata?: Record<string, any>) {
  addLog({ type: 'form_submit', page, details: `Form submitted: ${formName}`, metadata });
}

export function trackLogout(metadata?: Record<string, any>) {
  const durationMs = getSessionDurationMs();
  addLog({ type: 'logout', page: 'logout', details: 'User logged out', metadata: { url: window.location.href, device: getDeviceInfo(), sessionDurationMs: durationMs, ...metadata } });
}

// Send remaining logs on page unload
window.addEventListener('beforeunload', () => {
  const logs = getStoredLogs();
  if (logs.length > 0) {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${apiUrl}/api/client-logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs }),
      keepalive: true,
    }).catch(() => {});
    setLastFlushTime();
  }
});
