const CLOCK_SKEW_BUFFER_S = 30;

export function isTokenValid(token: string | null): boolean {
  if (!token || token === 'undefined') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp > Date.now() / 1000 + CLOCK_SKEW_BUFFER_S;
  } catch {
    return false;
  }
}

export function hasValidToken(): boolean {
  return isTokenValid(localStorage.getItem('token'));
}
