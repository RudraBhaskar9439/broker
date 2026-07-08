import { describe, it, expect, vi } from 'vitest';
import type { Plan } from '@broker/planner';
import { orchestrate, OrchestrationError } from './orchestrate';
import type { HireFn } from './types';

const step = (
  id: string,
  agentId: string,
  dependsOn: string[] = [],
  requirements = 'do it',
  priceUsdc = 0.1,
) => ({
  id,
  agentId,
  serviceId: `svc_${agentId}`,
  requirements,
  dependsOn,
  reason: '',
  priceUsdc,
});

const plan = (steps: Plan['steps']): Plan => ({
  goal: 'g',
  strategy: 'rule',
  steps,
  estCostUsdc: 0,
});

/** Fake hire echoing its requirements, with a fixed price. */
const echoHire: HireFn = async ({ serviceId, requirements, agentId }) => ({
  orderId: `ord_${agentId}`,
  payTxHash: `0x${agentId}`,
  priceUsdc: 0.1,
  text: `[${serviceId}] got: ${requirements}`,
});

describe('orchestrate', () => {
  it('runs a plan and records the order graph', async () => {
    const result = await orchestrate(plan([step('s1', 'a'), step('s2', 'b')]), { hire: echoHire });
    expect(result.graph.totalOrders).toBe(2);
    expect(result.graph.successfulOrders).toBe(2);
    expect(result.graph.totalSpentUsdc).toBeCloseTo(0.2);
    expect(result.finalText).toContain('## a');
    expect(result.finalText).toContain('## b');
  });

  it('passes upstream output into a dependent step as context', async () => {
    const seen: string[] = [];
    const spyHire: HireFn = async (req) => {
      seen.push(req.requirements);
      return { orderId: 'o', payTxHash: '0x', priceUsdc: 0.1, text: `out-of-${req.agentId}` };
    };
    await orchestrate(plan([step('s1', 'a'), step('s2', 'b', ['s1'], 'verify')]), {
      hire: spyHire,
    });
    const dependentReq = seen.find((r) => r.startsWith('verify'));
    expect(dependentReq).toContain('Context from prior agents');
    expect(dependentReq).toContain('out-of-a');
  });

  it('runs independent steps concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const slowHire: HireFn = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      return { orderId: 'o', payTxHash: '0x', priceUsdc: 0.1, text: 'x' };
    };
    await orchestrate(plan([step('s1', 'a'), step('s2', 'b'), step('s3', 'c')]), {
      hire: slowHire,
    });
    expect(maxActive).toBeGreaterThan(1); // proves parallelism
  });

  it('captures a failed step without aborting the rest', async () => {
    const flakyHire: HireFn = async ({ agentId }) => {
      if (agentId === 'b') throw new Error('provider down');
      return { orderId: 'o', payTxHash: '0x', priceUsdc: 0.1, text: 'ok' };
    };
    const result = await orchestrate(plan([step('s1', 'a'), step('s2', 'b'), step('s3', 'c')]), {
      hire: flakyHire,
    });
    expect(result.graph.successfulOrders).toBe(2);
    expect(result.outputs.s2?.status).toBe('failed');
    expect(result.outputs.s1?.status).toBe('success');
  });

  it('emits lifecycle events', async () => {
    const onEvent = vi.fn();
    await orchestrate(plan([step('s1', 'a')]), { hire: echoHire, onEvent });
    const types = onEvent.mock.calls.map((c) => c[0].type);
    expect(types).toContain('step:start');
    expect(types).toContain('step:done');
  });

  it('skips steps that would exceed the budget', async () => {
    const hired: string[] = [];
    const trackHire: HireFn = async ({ agentId }) => {
      hired.push(agentId);
      return { orderId: 'o', payTxHash: '0x', priceUsdc: 0.1, text: 'ok' };
    };
    // three 0.10 steps, budget 0.25 → only two fit (0.20); the third is skipped.
    const result = await orchestrate(plan([step('s1', 'a'), step('s2', 'b'), step('s3', 'c')]), {
      hire: trackHire,
      budgetUsdc: 0.25,
    });
    expect(hired).toHaveLength(2);
    expect(result.graph.successfulOrders).toBe(2);
    expect(result.graph.totalSpentUsdc).toBeCloseTo(0.2);
    expect(result.graph.receipts.filter((r) => r.status === 'skipped')).toHaveLength(1);
  });

  it('throws on a dependency cycle', async () => {
    const cyclic = plan([step('s1', 'a', ['s2']), step('s2', 'b', ['s1'])]);
    await expect(orchestrate(cyclic, { hire: echoHire })).rejects.toBeInstanceOf(
      OrchestrationError,
    );
  });
});
