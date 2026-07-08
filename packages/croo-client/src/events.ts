import type { Event, EventTypeName } from '@croo-network/sdk';

/**
 * Minimal structural view of the SDK's EventStream - anything with an `on`
 * subscription satisfies it, which keeps this module unit-testable without a
 * live WebSocket.
 */
export interface EventSource {
  on(eventType: string, handler: (event: Event) => void): void;
}

export interface WaitForEventOptions {
  /** Reject if no matching event arrives within this many ms. Default 120s. */
  timeoutMs?: number;
  /** Extra predicate - e.g. match only events for a specific order id. */
  match?: (event: Event) => boolean;
}

/**
 * Resolve with the first event of `type` that also passes the optional
 * predicate, or reject on timeout. This is the core primitive the consumer
 * flow uses to await `OrderCreated` and `OrderCompleted`.
 */
export function waitForEvent(
  source: EventSource,
  type: EventTypeName | string,
  options: WaitForEventOptions = {},
): Promise<Event> {
  const { timeoutMs = 120_000, match } = options;

  return new Promise<Event>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for '${type}' event`));
    }, timeoutMs);

    source.on(type, (event) => {
      if (settled) return;
      if (match && !match(event)) return;
      settled = true;
      clearTimeout(timer);
      resolve(event);
    });
  });
}

/** Predicate helper: match events carrying a specific `order_id`. */
export function forOrder(orderId: string): (event: Event) => boolean {
  return (event) => event.order_id === orderId;
}

/** Predicate helper: match events carrying a specific `negotiation_id`. */
export function forNegotiation(negotiationId: string): (event: Event) => boolean {
  return (event) => event.negotiation_id === negotiationId;
}
