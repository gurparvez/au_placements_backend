import { redis, cacheReady } from '../config/redis';
import { CONFIG } from '../config/environment';

/**
 * Cache-aside helpers over Redis with graceful degradation. Every function is a
 * no-op (or straight passthrough to the DB fn) when Redis is unavailable, so the
 * app behaves identically with or without a cache — just slower without one.
 *
 * Invalidation uses per-namespace version counters instead of KEYS/SCAN:
 *   - reads build keys as `<ns>:v<version>:<parts>`
 *   - a write calls bumpVersion(ns), which INCRs the counter → every old key is
 *     instantly unreachable (and later evicted by TTL). O(1), no scanning.
 */

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!cacheReady()) return null;
  try {
    const raw = await redis!.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = CONFIG.cache.defaultTtl): Promise<void> {
  if (!cacheReady()) return;
  try {
    await redis!.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    /* ignore cache write failures */
  }
}

async function nsVersion(ns: string): Promise<string> {
  if (!cacheReady()) return '0';
  try {
    return (await redis!.get(`ver:${ns}`)) || '0';
  } catch {
    return '0';
  }
}

/** Invalidate an entire namespace in O(1). Call after any write that affects it. */
export async function bumpVersion(ns: string): Promise<void> {
  if (!cacheReady()) return;
  try {
    await redis!.incr(`ver:${ns}`);
  } catch {
    /* ignore */
  }
}

/**
 * Cache-aside around a DB read, scoped to a namespace version.
 * `parts` should capture everything the result depends on (filters, page, viewer…).
 */
export async function cached<T>(
  ns: string,
  parts: Array<string | number | boolean | undefined>,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!cacheReady()) return fn();
  const version = await nsVersion(ns);
  const key = `${ns}:v${version}:${parts.map((p) => (p === undefined ? '' : String(p))).join(':')}`;
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const val = await fn();
  if (val !== null && val !== undefined) await cacheSet(key, val, ttl);
  return val;
}
