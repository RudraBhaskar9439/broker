import { EventType, DeliverableType, type AgentClient } from '@broker/croo-client';
import { createLogger, type Logger } from '@broker/logger';
import type { ProviderEvent, ProviderHandler } from './types';

export interface RunProviderOptions {
  client: AgentClient;
  /** Produces the deliverable text for a paid order. */
  handle: ProviderHandler;
  logger?: Logger;
  onEvent?: (event: ProviderEvent) => void;
}

/**
 * Run an in-house provider agent: auto-accept every negotiation, and on payment
 * produce a deliverable via `handle` and submit it on-chain. Returns a stop()
 * function that closes the event stream.
 *
 * This is the reliable counterpart Broker hires - we control acceptance and
 * delivery, so hires never hang or get rejected like flaky third parties.
 */
export async function runProvider(options: RunProviderOptions): Promise<() => void> {
  const { client, handle } = options;
  const log = options.logger ?? createLogger({ name: 'provider' });
  const stream = await client.connectWebSocket();

  stream.on(EventType.NegotiationCreated, (event) => {
    const negotiationId = event.negotiation_id;
    if (!negotiationId) return;
    void (async () => {
      try {
        await client.acceptNegotiation(negotiationId);
        log.info({ negotiationId }, 'accepted negotiation');
        options.onEvent?.({ type: 'accepted', negotiationId });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log.error({ negotiationId, error }, 'accept failed');
        options.onEvent?.({ type: 'error', stage: 'accept', id: negotiationId, error });
      }
    })();
  });

  stream.on(EventType.OrderPaid, (event) => {
    const orderId = event.order_id;
    if (!orderId) return;
    void (async () => {
      try {
        const order = await client.getOrder(orderId);
        const negotiation = await client.getNegotiation(order.negotiationId);
        const text = await produce(handle, {
          serviceId: order.serviceId,
          requirements: negotiation.requirements,
          orderId,
        });
        await client.deliverOrder(orderId, {
          deliverableType: DeliverableType.Text,
          deliverableText: text,
        });
        log.info({ orderId }, 'delivered');
        options.onEvent?.({ type: 'delivered', orderId });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log.error({ orderId, error }, 'deliver failed');
        options.onEvent?.({ type: 'error', stage: 'deliver', id: orderId, error });
      }
    })();
  });

  stream.on(EventType.OrderCompleted, (event) => {
    if (event.order_id) options.onEvent?.({ type: 'completed', orderId: event.order_id });
  });

  log.info('provider online - listening for negotiations');
  return () => stream.close();
}

/** Never throw out of a handler: deliver a graceful error note instead so the
 * order still completes rather than expiring. */
async function produce(
  handle: ProviderHandler,
  input: Parameters<ProviderHandler>[0],
): Promise<string> {
  try {
    const text = await handle(input);
    return text.trim() || '(no content produced)';
  } catch (err) {
    return `Error producing deliverable: ${err instanceof Error ? err.message : String(err)}`;
  }
}
