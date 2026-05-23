import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './storage';
import { config, optionalEnv } from './config';

// Hash the IP before it's ever used as a key so we never store raw addresses.
async function hashIp(ip: string): Promise<string> {
  const salt = optionalEnv('WALL_ADMIN_TOKEN', 'wall-rate-salt');
  const data = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

// Sliding window, N requests/hour per hashed IP. Constructed per call — Upstash
// REST is stateless, so there's no pool to reuse.
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const ratelimit = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(config.ratePerHour, '1 h'),
    prefix: 'wall:rate',
    analytics: false,
  });

  const key = await hashIp(ip);
  const { success, remaining, reset } = await ratelimit.limit(key);
  return { success, remaining, reset };
}
