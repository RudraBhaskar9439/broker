import { describe, it, expect } from 'vitest';
import { Registry, loadRegistry, RegistryError } from './registry';
import type { AgentEntryInput } from './schema';

const entry = (over: Partial<AgentEntryInput> = {}): AgentEntryInput => ({
  id: 'a1',
  name: 'Agent One',
  category: 'data-analytics',
  description: 'does things',
  capabilities: ['x'],
  inputHint: 'send x',
  ...over,
});

describe('loadRegistry', () => {
  it('validates the default roster without throwing', () => {
    expect(() => loadRegistry()).not.toThrow();
  });

  it('applies schema defaults', () => {
    const [e] = loadRegistry([entry()]);
    expect(e?.enabled).toBe(false);
    expect(e?.serviceId).toBe('');
    expect(e?.priceUsdc).toBe(0.1);
    expect(e?.source).toBe('third-party');
  });

  it('rejects duplicate ids', () => {
    expect(() => loadRegistry([entry({ id: 'dup' }), entry({ id: 'dup' })])).toThrow(RegistryError);
  });

  it('rejects duplicate wired serviceIds but allows many empty ones', () => {
    expect(() => loadRegistry([entry({ id: 'a' }), entry({ id: 'b' })])).not.toThrow();
    expect(() =>
      loadRegistry([
        entry({ id: 'a', serviceId: 'svc', enabled: true }),
        entry({ id: 'b', serviceId: 'svc', enabled: true }),
      ]),
    ).toThrow(/Duplicate serviceId/);
  });

  it('rejects an enabled entry with no serviceId', () => {
    expect(() => loadRegistry([entry({ enabled: true })])).toThrow();
  });
});

describe('Registry queries', () => {
  const registry = Registry.load([
    entry({ id: 'live', serviceId: 'svc_live', enabled: true, capabilities: ['polymarket', 'x'] }),
    entry({ id: 'off', enabled: false, capabilities: ['polymarket'] }),
    entry({
      id: 'inhouse',
      serviceId: 'svc_in',
      enabled: true,
      source: 'in-house',
      category: 'utility',
    }),
  ]);

  it('hireable() returns only enabled + wired agents', () => {
    expect(
      registry
        .hireable()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['inhouse', 'live']);
  });

  it('byCapability() searches only hireable agents', () => {
    expect(registry.byCapability('polymarket').map((e) => e.id)).toEqual(['live']);
  });

  it('bySource() includes disabled entries', () => {
    expect(registry.bySource('in-house').map((e) => e.id)).toEqual(['inhouse']);
  });

  it('capabilities() returns a sorted unique tag list', () => {
    expect(registry.capabilities()).toEqual(['polymarket', 'x']);
  });

  it('get() finds by id', () => {
    expect(registry.get('off')?.name).toBe('Agent One');
    expect(registry.get('missing')).toBeUndefined();
  });
});
