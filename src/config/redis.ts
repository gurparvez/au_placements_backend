import Redis from 'ioredis';
import { CONFIG } from './environment';

/**
 * Redis client with graceful degradation — mirrors the Cloudinary/Resend pattern.
 * If REDIS_URL is unset (local dev) or Redis is unreachable, the app keeps running
 * with caching disabled rather than crashing. Commands fail fast (offline queue off,
 * bounded retries) so a dead cache never blocks a request path.
 */
let client: Redis | null = null;

if (CONFIG.redisUrl) {
  client = new Redis(CONFIG.redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false, // fail fast instead of buffering when Redis is down
    connectTimeout: 3000,
    retryStrategy: (times) => (times > 8 ? null : Math.min(times * 200, 2000)),
  });

  let warned = false;
  client.on('error', (err) => {
    if (warned) return; // avoid log spam while Redis is down
    warned = true;
    console.warn('[redis] unavailable — running WITHOUT cache:', err.message);
  });
  client.on('ready', () => {
    warned = false;
    console.log('🧠 Redis connected — cache enabled');
  });
} else {
  console.log('[redis] REDIS_URL not set — cache disabled (no-op).');
}

export const redis = client;

/** True only when a command can actually be served right now. */
export const cacheReady = (): boolean => !!client && client.status === 'ready';

export async function closeRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
