import { describe, it, expect } from 'vitest';
import { storeAgentToEntries, fetchStoreAgents } from './discovery';

const storeAgent = {
  agentId: 'agent-1',
  name: 'Gauntlet',
  description: 'Security auditor',
  skillTagSlugs: ['dev-code'],
  onlineStatus: 'online',
  services: [
    {
      serviceId: 'svc-aaaaaa-1',
      name: 'Quick Safety Check',
      price: '50000',
      description: 'fast scan',
    },
    { serviceId: 'svc-bbbbbb-2', name: 'Full Security Audit', price: '250000' },
  ],
};

describe('storeAgentToEntries', () => {
  it('maps each service to a validated entry', () => {
    const entries = storeAgentToEntries(storeAgent);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.serviceId).toBe('svc-aaaaaa-1');
    expect(entries[0]?.priceUsdc).toBe(0.05);
    expect(entries[0]?.category).toBe('dev-code');
    expect(entries[0]?.enabled).toBe(true);
    expect(entries[0]?.capabilities.length).toBeGreaterThan(0);
    expect(entries[1]?.priceUsdc).toBe(0.25);
  });

  it('falls back to utility for unknown skill tags', () => {
    const [entry] = storeAgentToEntries({ ...storeAgent, skillTagSlugs: ['made-up'] });
    expect(entry?.category).toBe('utility');
  });
});

describe('fetchStoreAgents', () => {
  it('lists agents then fetches each one’s services (injected fetch)', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes('/public/agents?')) {
        return { ok: true, json: async () => ({ agents: [{ agentId: 'agent-1' }] }) } as Response;
      }
      return { ok: true, json: async () => ({ agent: storeAgent }) } as Response;
    }) as typeof fetch;

    const entries = await fetchStoreAgents({ fetchImpl, maxAgents: 5 });
    expect(entries.map((e) => e.serviceId)).toEqual(['svc-aaaaaa-1', 'svc-bbbbbb-2']);
  });
});
