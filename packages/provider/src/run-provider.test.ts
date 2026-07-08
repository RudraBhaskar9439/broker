import { describe, it, expect, vi } from 'vitest';
import type { AgentClient, Event } from '@broker/croo-client';
import { runProvider } from './run-provider';
import { echoHandler } from './handlers';

class FakeStream {
  handlers = new Map<string, ((e: Event) => void)[]>();
  on(type: string, h: (e: Event) => void) {
    const list = this.handlers.get(type) ?? [];
    list.push(h);
    this.handlers.set(type, list);
  }
  emit(type: string, e: Event) {
    for (const h of this.handlers.get(type) ?? []) h(e);
  }
  close() {}
}

function fakeClient(stream: FakeStream) {
  const accept = vi.fn(async (_negotiationId: string) => ({}));
  const deliver = vi.fn(async (_orderId: string, _req: { deliverableText?: string }) => ({}));
  const client = {
    connectWebSocket: async () => stream,
    acceptNegotiation: accept,
    getOrder: async (orderId: string) => ({ orderId, negotiationId: 'neg_1', serviceId: 'svc_1' }),
    getNegotiation: async () => ({ requirements: 'summarise X' }),
    deliverOrder: deliver,
  } as unknown as AgentClient;
  return { client, accept, deliver };
}

const flush = () => new Promise((r) => setTimeout(r, 5));

describe('runProvider', () => {
  it('auto-accepts negotiations', async () => {
    const stream = new FakeStream();
    const { client, accept } = fakeClient(stream);
    await runProvider({ client, handle: echoHandler() });
    stream.emit('order_negotiation_created', { type: 'x', raw: {}, negotiation_id: 'neg_1' });
    await flush();
    expect(accept).toHaveBeenCalledWith('neg_1');
  });

  it('delivers handler output on payment', async () => {
    const stream = new FakeStream();
    const { client, deliver } = fakeClient(stream);
    await runProvider({ client, handle: echoHandler('scout') });
    stream.emit('order_paid', { type: 'x', raw: {}, order_id: 'order_1' });
    await flush();
    expect(deliver).toHaveBeenCalledTimes(1);
    const [orderId, req] = deliver.mock.calls[0]!;
    expect(orderId).toBe('order_1');
    expect(req.deliverableText).toContain('summarise X');
  });
});
