import pino, { type Logger, type Level } from 'pino';

export type { Logger, Level };

export interface CreateLoggerOptions {
  /** Minimum level to emit. Defaults to LOG_LEVEL env or 'info'. */
  level?: Level;
  /** Optional component name attached to every line. */
  name?: string;
}

/**
 * Create a structured logger. JSON by default (safe everywhere); set
 * BROKER_PRETTY=1 in development to opt into human-friendly output.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.LOG_LEVEL as Level | undefined) ?? 'info';
  const pretty = process.env.BROKER_PRETTY === '1';

  return pino({
    level,
    ...(options.name ? { name: options.name } : {}),
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}

/** A ready-to-use root logger for quick scripts. */
export const logger: Logger = createLogger({ name: 'broker' });
