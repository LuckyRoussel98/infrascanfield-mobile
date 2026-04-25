/**
 * Lightweight wrapper around console.* with a single switch to silence in production.
 * Replace `console.log` with `logger.debug` everywhere — no `console.*` should remain
 * in production code.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: LogLevel = __DEV__ ? 'debug' : 'warn';

export const logger = {
  setLevel(level: LogLevel) {
    minLevel = level;
  },

  debug(message: string, ...args: unknown[]) {
    if (LEVEL_RANK[minLevel] <= LEVEL_RANK.debug) {
      // eslint-disable-next-line no-console
      console.log(`[debug] ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (LEVEL_RANK[minLevel] <= LEVEL_RANK.info) {
      // eslint-disable-next-line no-console
      console.info(`[info] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]) {
    if (LEVEL_RANK[minLevel] <= LEVEL_RANK.warn) {
      console.warn(`[warn] ${message}`, ...args);
    }
  },

  error(message: string, ...args: unknown[]) {
    if (LEVEL_RANK[minLevel] <= LEVEL_RANK.error) {
      console.error(`[error] ${message}`, ...args);
    }
  },
};
