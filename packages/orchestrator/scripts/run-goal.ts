/**
 * Phase 5 proof gate.
 *
 *   pnpm run:goal "should I copy-trade polymarket wallet 0xabc"      # dry-run, $0
 *   pnpm run:goal -- --llm "..."                                     # Grok planner
 *   pnpm run:goal -- --live "..."                                    # REAL hires (spends USDC)
 *
 * Dry-run uses a mock hire so the full plan → orchestrate → receipt-trail flow
 * is proven without spending. --live wires the real on-chain hire.
 */
import 'dotenv/config';
import { Registry, discoverRegistry, type AgentEntryInput } from '@maestro/registry';
import { RulePlanner, LlmPlanner, type Planner } from '@maestro/planner';
import { orchestrate, makeCrooHire, type HireFn } from '@maestro/orchestrator';
import { formatOrderGraph } from '@maestro/receipts';

const DEMO_ROSTER: AgentEntryInput[] = [
  {
    id: 'polymarket-wallet',
    name: 'Polymarket Smart Wallet Tracker',
    category: 'data-analytics',
    description: 'Analyses a Polymarket smart wallet',
    capabilities: ['polymarket', 'wallet-analysis', 'onchain-intel'],
    inputHint: 'a 0x wallet address',
    serviceId: 'demo_poly',
    enabled: true,
    source: 'in-house',
  },
  {
    id: 'veris',
    name: 'VERIS',
    category: 'research-report',
    description: 'Due diligence and trust scoring',
    capabilities: ['due-diligence', 'trust', 'verification'],
    inputHint: 'a project/token/address',
    serviceId: 'demo_veris',
    enabled: true,
    source: 'in-house',
  },
  {
    id: 'alphatrack',
    name: 'AlphaTrack',
    category: 'data-analytics',
    description: 'Tracks top Binance traders and signals',
    capabilities: ['binance', 'trader-tracking', 'trading-signals'],
    inputHint: 'a trader handle',
    serviceId: 'demo_alpha',
    enabled: true,
    source: 'in-house',
  },
];

const mockHire: HireFn = async ({ serviceId, requirements, agentId }) => {
  const summary = requirements.split('\n')[0]?.slice(0, 60) ?? '';
  return {
    orderId: `mock_${agentId}`,
    payTxHash: `0xMOCK${agentId}`,
    priceUsdc: 0.1,
    text: `Mock result from ${serviceId}: handled "${summary}"`,
  };
};

async function buildPlanner(useLlm: boolean): Promise<Planner> {
  if (!useLlm) return new RulePlanner();
  const { safeLoadConfig } = await import('@maestro/config');
  const parsed = safeLoadConfig();
  if (!parsed.success || !parsed.data.llmApiKey) {
    throw new Error('--llm needs LLM_API_KEY in .env');
  }
  return new LlmPlanner({
    apiKey: parsed.data.llmApiKey,
    baseUrl: parsed.data.llmBaseUrl,
    model: parsed.data.llmModel,
  });
}

async function buildHire(live: boolean): Promise<HireFn> {
  if (!live) return mockHire;
  const { safeLoadConfig } = await import('@maestro/config');
  const { createAgentClient } = await import('@maestro/croo-client');
  const { createLogger } = await import('@maestro/logger');
  const parsed = safeLoadConfig();
  if (!parsed.success) throw new Error('--live needs a valid .env');
  const client = createAgentClient(parsed.data, {
    logger: createLogger({ name: 'orchestrator', level: 'warn' }),
  });
  return makeCrooHire(client);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const useLlm = argv.includes('--llm');
  const live = argv.includes('--live');
  const useDiscover = argv.includes('--discover');
  const budgetArg = argv.find((a) => a.startsWith('--budget='));
  const budgetUsdc = budgetArg ? Number(budgetArg.split('=')[1]) : undefined;
  const goal = argv
    .filter((a) => !a.startsWith('--'))
    .join(' ')
    .trim();

  if (!goal) {
    console.error('Usage: pnpm run:goal "<goal>" [--llm] [--live] [--discover]');
    process.exitCode = 1;
    return;
  }

  // --discover: plan across agents pulled live from the store's public API.
  // (Best with dry-run: third-party agents are unreliable to actually hire.)
  const real = useDiscover ? await discoverRegistry({ onlineOnly: true }) : Registry.load();
  const usingDemo = real.hireable().length === 0;
  const registry = usingDemo ? Registry.load(DEMO_ROSTER) : real;

  const planner = await buildPlanner(useLlm);
  const hire = await buildHire(live);

  console.log(
    `Maestro · orchestrate  [planner=${planner.name}, mode=${live ? 'LIVE' : 'dry-run'}]`,
  );
  if (usingDemo) console.log('(demo roster — no real agents wired yet)');
  console.log(`Goal: ${goal}\n`);

  const plan = await planner.plan(goal, registry);
  if (plan.steps.length === 0) {
    console.log('No agents matched the goal.');
    return;
  }

  const result = await orchestrate(plan, {
    hire,
    budgetUsdc,
    onEvent: (e) => {
      if (e.type === 'step:start') console.log(`→ hiring ${e.agentId} …`);
      else if (e.type === 'step:done')
        console.log(`  ✔ ${e.agentId} paid ${e.priceUsdc.toFixed(2)} USDC · ${e.payTxHash}`);
      else if (e.type === 'step:skipped') console.log(`  ⊘ ${e.agentId}: ${e.note}`);
      else console.log(`  ✖ ${e.agentId}: ${e.error}`);
    },
  });

  console.log(`\n${formatOrderGraph(result.graph)}\n`);
  console.log('── composed result ─────────────────────────');
  console.log(result.finalText);
  console.log('────────────────────────────────────────────');
  console.log('\n✅ Phase 5 proof: plan orchestrated, order graph recorded.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
