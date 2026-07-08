/**
 * Phase 6/7 — run Broker as a callable provider agent.
 *
 *   pnpm broker
 *
 * Broker is registered on the CROO Agent Store with an "orchestrate" service.
 * When another agent (or a human) hires it, Broker plans the goal, hires its
 * sub-agents (Scout) on-chain, composes their outputs, and delivers the result.
 * This makes Broker both hireable (H2A) and a hirer (A2A) — a full node in the
 * agent economy.
 *
 * Uses CROO_SDK_KEY (Broker). Run alongside `pnpm worker` (Scout).
 */
import 'dotenv/config';
import { safeLoadConfig } from '@broker/config';
import { createLogger } from '@broker/logger';
import { createAgentClient } from '@broker/croo-client';
import { Registry } from '@broker/registry';
import { RulePlanner, LlmPlanner, budgetToMaxSteps, type Planner } from '@broker/planner';
import { runProvider, extractTask, type ProviderHandler } from '@broker/provider';
import { orchestrate, makeCrooHire } from '../src/index';

async function main(): Promise<void> {
  const parsed = safeLoadConfig();
  if (!parsed.success) {
    console.error('✖ Invalid .env');
    process.exitCode = 1;
    return;
  }
  const config = parsed.data;
  const logger = createLogger({ name: 'broker', level: config.logLevel });

  // Broker's own client — used both to accept incoming orders (provider) and
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

  // Keep a margin + fee/gas reserve: at least $0.05, at least 20% of the price.
  // So Broker always profits, and the tier (price) sets how big a team it hires.
  const reserveFor = (paid: number): number => Math.max(0.05, paid * 0.2);

  const handle: ProviderHandler = async ({ requirements, orderId }) => {
    const goal = extractTask(requirements);
    // Budget + depth scale with the tier the buyer paid for.
    let budgetUsdc: number | undefined;
    let maxSteps: number | undefined;
    try {
      const order = await client.getOrder(orderId);
      const paid = Number(order.price || '0') / 1e6;
      budgetUsdc = Math.max(0, paid - reserveFor(paid));
      maxSteps = budgetToMaxSteps(budgetUsdc);
    } catch {
      budgetUsdc = undefined;
    }
    logger.info({ goal, budgetUsdc, maxSteps }, 'orchestrating hired goal');

    const plan = await planner.plan(goal, registry, { maxSteps });
    if (plan.steps.length === 0) {
      return `Broker could not find suitable sub-agents for: ${goal}`;
    }
    const result = await orchestrate(plan, { hire, budgetUsdc });
    return result.finalText;
  };

  console.log('Broker · orchestrator agent (provider)');
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

  console.log('Broker is online and hireable. Ctrl+C to stop.\n');
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
