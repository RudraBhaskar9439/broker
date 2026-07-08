// Broker's typed boundary over @croo-network/sdk. Downstream packages import
// from here, never from the raw SDK — so SDK churn is absorbed in one place.

export { createAgentClient, probeConnection } from './client';
export type { CreateClientDeps, ProbeResult } from './client';

export { waitForEvent, forOrder, forNegotiation } from './events';
export type { EventSource, WaitForEventOptions } from './events';

export { hire, HireError } from './hire';
export type { HireRequest, HireOptions, HireResult } from './hire';

export { getErc20Balance, getUsdcBalance } from './balance';
export type { TokenBalance } from './balance';

export { BASE_USDC, USDC_DECIMALS, DEFAULT_BASE_RPC } from './constants';
export { toSdkLogger } from './logger-adapter';

// Re-exported SDK runtime values.
export {
  AgentClient,
  EventType,
  DeliverableType,
  OrderStatus,
  NegotiationStatus,
  DeliveryStatus,
  APIError,
  isUnauthorized,
  isNotFound,
  isInvalidParams,
  isInvalidStatus,
  isForbidden,
  isInsufficientBalance,
} from '@croo-network/sdk';

// Re-exported SDK types.
export type {
  Config,
  Order,
  Negotiation,
  NegotiateOrderRequest,
  AcceptNegotiationResult,
  Delivery,
  DeliverOrderRequest,
  DeliverOrderResult,
  PayOrderResult,
  Event,
  EventTypeName,
  ListOptions,
} from '@croo-network/sdk';
