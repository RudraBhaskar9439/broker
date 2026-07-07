import { z } from 'zod';

/**
 * Validated shape of every environment value Maestro depends on.
 *
 * Secrets (SDK key, Anthropic key) are optional at the schema level so that
 * early phases and unit tests can load a partial config without them; the
 * commands that actually need a secret assert its presence at their edge.
 */
export const configSchema = z.object({
  crooApiUrl: z.string().url(),
  crooWsUrl: z.string().url(),
  crooSdkKey: z.string().min(1),
  /** Maestro's AA wallet address on Base (shown in the CROO dashboard). */
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed 20-byte address')
    .optional(),
  baseRpcUrl: z.string().url().optional(),
  anthropicApiKey: z.string().min(1).optional(),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type MaestroConfig = z.infer<typeof configSchema>;

/** Maps raw process env vars onto the config schema's input shape. */
function fromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  return {
    crooApiUrl: env.CROO_API_URL,
    crooWsUrl: env.CROO_WS_URL,
    crooSdkKey: env.CROO_SDK_KEY,
    walletAddress: env.MAESTRO_WALLET_ADDRESS,
    baseRpcUrl: env.BASE_RPC_URL,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    logLevel: env.LOG_LEVEL,
  };
}

/**
 * Load and validate configuration from the given environment.
 * Throws a {@link z.ZodError} with a readable report if anything is invalid.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): MaestroConfig {
  return configSchema.parse(fromEnv(env));
}

/** Non-throwing variant — returns a zod SafeParseReturnType for callers that
 * want to render their own error message. */
export function safeLoadConfig(env: NodeJS.ProcessEnv = process.env) {
  return configSchema.safeParse(fromEnv(env));
}
