import { AgentClient } from '@croo-network/sdk';
import type { Config as SdkConfig } from '@croo-network/sdk';
import type { MaestroConfig } from '@maestro/config';
import { createLogger, type Logger } from '@maestro/logger';
import { toSdkLogger } from './logger-adapter';

export interface CreateClientDeps {
  /** Inject a logger; one is created from config if omitted. */
  logger?: Logger;
}

/**
 * Build a configured {@link AgentClient} from Maestro's validated config.
 * This is the single place Maestro constructs an SDK client, so wiring
 * (endpoints, logger adapter) lives in exactly one spot.
 */
export function createAgentClient(config: MaestroConfig, deps: CreateClientDeps = {}): AgentClient {
  const logger = deps.logger ?? createLogger({ name: 'croo-client', level: config.logLevel });
  const sdkConfig: SdkConfig = {
    baseURL: config.crooApiUrl,
    wsURL: config.crooWsUrl,
    rpcURL: config.baseRpcUrl,
    logger: toSdkLogger(logger),
  };
  return new AgentClient(sdkConfig, config.crooSdkKey);
}

export interface ProbeResult {
  /** SDK key accepted by an authenticated endpoint. */
  authOk: boolean;
  /** WebSocket event stream opened successfully. */
  wsOk: boolean;
  /** Number of existing orders returned by the auth probe. */
  orderCount: number;
}

/**
 * Verify connectivity end-to-end: an authenticated REST call (proves the SDK
 * key) plus a WebSocket handshake (proves the event stream). Throws if either
 * leg fails — callers translate the error for the user.
 */
export async function probeConnection(client: AgentClient): Promise<ProbeResult> {
  const orders = await client.listOrders({ pageSize: 1 });
  const stream = await client.connectWebSocket();
  stream.close();
  return { authOk: true, wsOk: true, orderCount: orders.length };
}
