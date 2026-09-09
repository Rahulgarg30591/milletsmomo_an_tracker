const CLOCK_SKEW_BUFFER_S = 30;

/**
 * Decodes a standard-base64 token segment as UTF-8.
 *
 * The backend base64-encodes UTF-8 bytes, but `atob` yields one character per
 * byte, so a multi-byte display name decoded to mojibake ("Café" -> "CafÃ©").
 */
export function decodeTokenSegment(segment: string): unknown {
  const binary = atob(segment);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function isTokenValid(token: string | null): boolean {
  if (!token || token === 'undefined') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = decodeTokenSegment(parts[1]) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp > Date.now() / 1000 + CLOCK_SKEW_BUFFER_S;
  } catch {
    return false;
  }
}

export function hasValidToken(): boolean {
  return isTokenValid(localStorage.getItem('token'));
}
