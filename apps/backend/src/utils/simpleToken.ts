import crypto from 'crypto';

/**
 * Static fallback secret. Overridable via MM_TOKEN_SECRET for production.
 * Shipped only in the backend bundle (never reaches the client).
 */
const DEFAULT_SECRET =
  'mm-shop-static-token-secret-7f3a9c1e5b8d4a2f6e0c8d7b9a3f1e2c4d6b8a0f2e4c6d8b0a2f4e6c8d0b2a4f6e8c0d2b4a6f8e0c2d4b6a8f0e2d4c6b8a0f2e4c6d8b0a2f4e6c8d0b2a4';

const SECRET = process.env.MM_TOKEN_SECRET || DEFAULT_SECRET;

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'MM' })).toString('base64');

/**
 * Token payload returned by {@link signToken} and verified by {@link verifyToken}.
 */
export interface TokenPayload {
  sub: string;
  role: string;
  displayName: string;
  exp: number;
}

/**
 * Signs a token with an HMAC-SHA256 signature and a 12h expiry.
 *
 * Token shape: `base64(header).base64(payload).base64(signature)`.
 * Uses standard base64 (not base64url) so the frontend can decode the payload
 * at index 1 via `atob(parts[1])` (AuthContext, tracking) without url-safe
 * char issues. The `.` delimiter is safe — it never appears in base64 output.
 *
 * @param sub - User id as string.
 * @param role - User role ('staff' | 'admin').
 * @param displayName - User display name.
 * @param ttlSeconds - Lifetime in seconds; defaults to 12h (43200).
 * @returns The signed token string.
 */
export function signToken(
  sub: string,
  role: string,
  displayName: string,
  ttlSeconds = 43200,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(
    JSON.stringify({ sub, role, displayName, exp }),
  ).toString('base64');
  const data = `${HEADER}.${payload}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64');
  return `${data}.${signature}`;
}

/**
 * Verifies a token's signature and expiry.
 *
 * @returns The decoded payload, or `null` if invalid, tampered, or expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64');

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  let decoded: TokenPayload;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
  } catch {
    return null;
  }

  if (typeof decoded.exp !== 'number' || decoded.exp <= Date.now() / 1000) {
    return null;
  }
  return decoded;
}
