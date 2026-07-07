import { describe, it, expect } from 'vitest';
import type { Event } from '@croo-network/sdk';
import { waitForEvent, forOrder, type EventSource } from './events';

/** In-memory stand-in for the SDK EventStream. */
class FakeSource implements EventSource {
  private handlers = new Map<string, ((event: Event) => void)[]>();

  on(eventType: string, handler: (event: Event) => void): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  emit(eventType: string, event: Event): void {
    for (const handler of this.handlers.get(eventType) ?? []) handler(event);
  }
}

const evt = (over: Partial<Event> = {}): Event => ({ type: 'order_created', raw: {}, ...over });

describe('waitForEvent', () => {
  it('resolves with the first matching event', async () => {
    const source = new FakeSource();
    const promise = waitForEvent(source, 'order_created');
    source.emit('order_created', evt({ order_id: 'o1' }));
    await expect(promise).resolves.toMatchObject({ order_id: 'o1' });
  });

  it('ignores events that fail the predicate', async () => {
    const source = new FakeSource();
    const promise = waitForEvent(source, 'order_created', { match: forOrder('o2') });
    source.emit('order_created', evt({ order_id: 'o1' })); // wrong order — ignored
    source.emit('order_created', evt({ order_id: 'o2' })); // match
    await expect(promise).resolves.toMatchObject({ order_id: 'o2' });
  });

  it('rejects on timeout', async () => {
    const source = new FakeSource();
    await expect(waitForEvent(source, 'order_completed', { timeoutMs: 20 })).rejects.toThrow(
      /Timed out/,
    );
  });
});
