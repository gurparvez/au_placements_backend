import { CONFIG } from '../config/environment';

/**
 * Tiny dependency-free structured logger. JSON lines in production (ready for
 * any log aggregator), compact human-readable output in dev. Swap for pino later
 * without touching call sites — the API is `logger.info(fields, message)`.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[(CONFIG.logLevel as Level)] ?? ORDER.info;
const isProd = CONFIG.env === 'production';

function emit(level: Level, fields: Record<string, unknown>, msg?: string) {
  if (ORDER[level] < threshold) return;
  const record = { level, time: new Date().toISOString(), ...(msg ? { msg } : {}), ...fields };
  if (isProd) {
    process.stdout.write(JSON.stringify(record) + '\n');
  } else {
    const rest = Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
    process.stdout.write(`${record.time.slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${msg ?? ''}${rest}\n`);
  }
}

const norm = (o: Record<string, unknown> | string, m?: string): [Record<string, unknown>, string | undefined] =>
  typeof o === 'string' ? [{}, o] : [o, m];

export const logger = {
  debug: (o: Record<string, unknown> | string, m?: string) => emit('debug', ...norm(o, m)),
  info: (o: Record<string, unknown> | string, m?: string) => emit('info', ...norm(o, m)),
  warn: (o: Record<string, unknown> | string, m?: string) => emit('warn', ...norm(o, m)),
  error: (o: Record<string, unknown> | string, m?: string) => emit('error', ...norm(o, m)),
};
