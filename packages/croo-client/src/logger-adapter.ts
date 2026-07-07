import type { Logger as PinoLogger } from '@maestro/logger';
import type { Logger as SdkLogger } from '@croo-network/sdk';

/**
 * Adapt a pino logger to the minimal `Logger` interface the CROO SDK expects.
 * Extra positional args are preserved under a `details` field so nothing is
 * silently dropped.
 */
export function toSdkLogger(log: PinoLogger): SdkLogger {
  return {
    info(message: string, ...args: unknown[]): void {
      if (args.length) log.info({ details: args }, message);
      else log.info(message);
    },
    warn(message: string, ...args: unknown[]): void {
      if (args.length) log.warn({ details: args }, message);
      else log.warn(message);
    },
    error(message: string, ...args: unknown[]): void {
      if (args.length) log.error({ details: args }, message);
      else log.error(message);
    },
    debug(message: string, ...args: unknown[]): void {
      if (args.length) log.debug({ details: args }, message);
      else log.debug(message);
    },
  };
}
