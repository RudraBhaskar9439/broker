import { hire as crooHire, type AgentClient, type HireOptions } from '@broker/croo-client';
import type { HireFn, HireOutcome } from './types';

const USDC_DECIMALS = 6;

/** Convert a USDC base-unit string (6 decimals) to a number. */
function usdcToNumber(base: string): number {
  if (!base) return 0;
  return Number(base) / 10 ** USDC_DECIMALS;
}

/**
 * Real hire function: wraps croo-client's on-chain `hire()` and maps its result
 * to the orchestrator's {@link HireOutcome}. Spends real USDC - used with the
 * run:goal `--live` flag and the provider app.
 */
export function makeCrooHire(client: AgentClient, options?: HireOptions): HireFn {
  return async ({ serviceId, requirements }) => {
    const result = await crooHire(client, { serviceId, requirements }, options);
    const outcome: HireOutcome = {
      orderId: result.orderId,
      payTxHash: result.payTxHash,
      priceUsdc: usdcToNumber(result.price),
      text: result.text ?? (result.json !== undefined ? JSON.stringify(result.json) : ''),
      json: result.json,
    };
    return outcome;
  };
}
