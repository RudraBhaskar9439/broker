import { describe, it, expect } from 'vitest';
import { Registry, type AgentEntryInput } from '@broker/registry';
import { RulePlanner } from './rule-planner';
import { LlmPlanner } from './llm-planner';
import { budgetToMaxSteps } from './types';
import type { ChatFn } from './llm';

describe('budgetToMaxSteps', () => {
  it('scales the step target with the budget (tiers)', () => {
    expect(budgetToMaxSteps(0.05)).toBeLessThanOrEqual(2); // Quick tier
    expect(budgetToMaxSteps(0.25)).toBeGreaterThanOrEqual(3); // Standard tier
    expect(budgetToMaxSteps(0.8)).toBe(10); // Pro tier (capped)
  });
});

const roster: AgentEntryInput[] = [
  {
    id: 'polymarket-wallet',
    name: 'Polymarket Smart Wallet Tracker',
    category: 'data-analytics',
    description: 'Analyses a Polymarket wallet',
    capabilities: ['polymarket', 'wallet-analysis'],
    inputHint: 'a wallet address',
    serviceId: 'svc_poly',
    enabled: true,
  },
  {
    id: 'veris',
    name: 'VERIS',
    category: 'research-report',
    description: 'Due diligence and trust checks',
    capabilities: ['due-diligence', 'trust'],
    inputHint: 'a project name',
    serviceId: 'svc_veris',
    enabled: true,
  },
  {
    id: 'swapgod',
    name: 'SwapGod',
    category: 'defi-trading',
    description: 'Executes token swaps',
    capabilities: ['swap', 'execution'],
    inputHint: 'a swap intent',
    serviceId: 'svc_swap',
    enabled: true,
  },
];

const registry = Registry.load(roster);

describe('RulePlanner', () => {
  it('selects agents whose capabilities match the goal', async () => {
    const plan = await new RulePlanner().plan(
      'analyse this polymarket wallet and run due diligence',
      registry,
    );
    const ids = plan.steps.map((s) => s.agentId);
    expect(ids).toContain('polymarket-wallet');
    expect(ids).toContain('veris');
    expect(ids).not.toContain('swapgod');
    expect(plan.strategy).toBe('rule');
    expect(plan.estCostUsdc).toBeCloseTo(0.2);
  });

  it('resolves serviceIds and produces stable step ids', async () => {
    const plan = await new RulePlanner().plan('polymarket wallet', registry);
    expect(plan.steps[0]?.id).toBe('s1');
    expect(plan.steps[0]?.serviceId).toBe('svc_poly');
  });

  it('returns an empty plan when nothing matches', async () => {
    const plan = await new RulePlanner().plan('bake a cake', registry);
    expect(plan.steps).toHaveLength(0);
  });

  it('honours maxAgents', async () => {
    const plan = await new RulePlanner({ maxAgents: 1 }).plan(
      'polymarket wallet due-diligence swap',
      registry,
    );
    expect(plan.steps).toHaveLength(1);
  });

  it('honours the per-call maxSteps option (tier depth)', async () => {
    const plan = await new RulePlanner().plan('polymarket wallet due-diligence swap', registry, {
      maxSteps: 2,
    });
    expect(plan.steps.length).toBeLessThanOrEqual(2);
  });
});

describe('LlmPlanner', () => {
  const fakeChat =
    (json: unknown): ChatFn =>
    async () =>
      JSON.stringify(json);

  it('builds steps from LLM output and remaps 1-based deps to step ids', async () => {
    const chat = fakeChat({
      steps: [
        {
          agentId: 'polymarket-wallet',
          requirements: 'wallet 0xabc',
          dependsOn: [],
          reason: 'data',
        },
        { agentId: 'veris', requirements: 'verify it', dependsOn: [1], reason: 'trust' },
      ],
    });
    const plan = await new LlmPlanner(
      { apiKey: 'x', baseUrl: 'http://x', model: 'grok' },
      chat,
    ).plan('copy-trade check', registry);
    expect(plan.strategy).toBe('llm');
    expect(plan.steps.map((s) => s.agentId)).toEqual(['polymarket-wallet', 'veris']);
    expect(plan.steps[1]?.dependsOn).toEqual(['s1']); // step 1 → s1
    expect(plan.steps[0]?.serviceId).toBe('svc_poly');
  });

  it('supports hiring the same agent for multiple sub-tasks', async () => {
    const chat = fakeChat({
      steps: [
        { agentId: 'veris', requirements: 'sub-task A', dependsOn: [], reason: 'a' },
        { agentId: 'veris', requirements: 'sub-task B', dependsOn: [1], reason: 'b' },
      ],
    });
    const plan = await new LlmPlanner(
      { apiKey: 'x', baseUrl: 'http://x', model: 'grok' },
      chat,
    ).plan('two-part analysis', registry);
    expect(plan.steps.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(plan.steps.map((s) => s.agentId)).toEqual(['veris', 'veris']);
    expect(plan.steps[1]?.dependsOn).toEqual(['s1']);
  });

  it('drops hallucinated agents not in the registry', async () => {
    const chat = fakeChat({
      steps: [
        { agentId: 'does-not-exist', requirements: 'x', dependsOn: [], reason: '' },
        { agentId: 'swapgod', requirements: 'swap', dependsOn: [], reason: '' },
      ],
    });
    const plan = await new LlmPlanner(
      { apiKey: 'x', baseUrl: 'http://x', model: 'grok' },
      chat,
    ).plan('swap', registry);
    expect(plan.steps.map((s) => s.agentId)).toEqual(['swapgod']);
  });
});
