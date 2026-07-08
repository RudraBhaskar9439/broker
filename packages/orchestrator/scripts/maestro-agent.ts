/**
 * Phase 6/7 — run Maestro as a callable provider agent.
 *
 *   pnpm maestro
 *
 * Maestro is registered on the CROO Agent Store with an "orchestrate" service.
 * When another agent (or a human) hires it, Maestro plans the goal, hires its
 * sub-agents (Scout) on-chain, composes their outputs, and delivers the result.
 * This makes Maestro both hireable (H2A) and a hirer (A2A) — a full node in the
 * agent economy.
 *
 * Uses CROO_SDK_KEY (Maestro). Run alongside `pnpm worker` (Scout).
 */
import 'dotenv/config';
import { safeLoadConfig } from '@maestro/config';
import { createLogger } from '@maestro/logger';
import { createAgentClient } from '@maestro/croo-client';
import { Registry } from '@maestro/registry';
import { RulePlanner, LlmPlanner, type Planner } from '@maestro/planner';
import { runProvider, extractTask, type ProviderHandler } from '@maestro/provider';
import { orchestrate, makeCrooHire } from '../src/index';

async function main(): Promise<void> {
  const parsed = safeLoadConfig();
  if (!parsed.success) {
    console.error('✖ Invalid .env');
    process.exitCode = 1;
    return;
  }
  const config = parsed.data;
  const logger = createLogger({ name: 'maestro', level: config.logLevel });

  // Maestro's own client — used both to accept incoming orders (provider) and
  // to hire sub-agents (requester).
  const client = createAgentClient(config, { logger });
  const registry = Registry.load();
  const hire = makeCrooHire(client);

  const planner: Planner = config.llmApiKey
    ? new LlmPlanner({
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        model: config.llmModel,
      })
    : new RulePlanner();

  // Reserve for Maestro's own protocol fee + gas on the sub-hires.
  const RESERVE_USDC = 0.05;

  const handle: ProviderHandler = async ({ requirements, orderId }) => {
    const goal = extractTask(requirements);
    // Budget = what Maestro was paid for this order, minus a fee/gas reserve.
    // Maestro never spends more than this on sub-agents.
    let budgetUsdc: number | undefined;
    try {
      const order = await client.getOrder(orderId);
      const paid = Number(order.price || '0') / 1e6;
      budgetUsdc = Math.max(0, paid - RESERVE_USDC);
    } catch {
      budgetUsdc = undefined;
    }
    logger.info({ goal, budgetUsdc }, 'orchestrating hired goal');

    const plan = await planner.plan(goal, registry);
    if (plan.steps.length === 0) {
      return `Maestro could not find suitable sub-agents for: ${goal}`;
    }
    const result = await orchestrate(plan, { hire, budgetUsdc });
    return result.finalText;
  };

  console.log('Maestro · orchestrator agent (provider)');
  console.log(`planner: ${planner.name} · sub-agents: ${registry.hireable().length}`);

  const stop = await runProvider({
    client,
    handle,
    logger,
    onEvent: (e) => {
      if (e.type === 'accepted') console.log(`✔ accepted hire ${e.negotiationId}`);
      else if (e.type === 'delivered') console.log(`📦 delivered orchestration ${e.orderId}`);
      else if (e.type === 'completed') console.log(`✅ completed ${e.orderId}`);
      else console.log(`✖ ${e.stage} error (${e.id}): ${e.error}`);
    },
  });

  console.log('Maestro is online and hireable. Ctrl+C to stop.\n');
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
