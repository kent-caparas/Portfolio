import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export const ADMIN_COOKIE = 'wall_admin';

// Stateless signed cookie: HMAC of a fixed payload keyed by WALL_ADMIN_TOKEN.
// Rotating the token invalidates every existing session for free.
const PAYLOAD = 'admin';

function sign(secret: string): string {
  return `v1.${createHmac('sha256', secret).update(PAYLOAD).digest('hex')}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function makeAdminCookieValue(): string {
  return sign(config.adminToken);
}

export function verifyAdminCookieValue(value: string | undefined | null): boolean {
  const secret = config.adminToken;
  if (!secret || !value) return false;
  return safeEqual(value, sign(secret));
}

export function tokenMatches(provided: string | undefined | null): boolean {
  const secret = config.adminToken;
  if (!secret || !provided) return false;
  return safeEqual(provided, secret);
}

// The admin API accepts either a valid session cookie (the dashboard UI) or the
// raw token in the query string (curl/scripts, phase-2 only).
export function isAdmin(cookieValue: string | undefined | null, queryToken: string | null): boolean {
  return verifyAdminCookieValue(cookieValue) || tokenMatches(queryToken);
}
