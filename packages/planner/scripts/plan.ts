/**
 * Phase 4 proof gate.
 *
 *   pnpm plan "should I copy-trade this polymarket wallet 0xabc"
 *   pnpm plan -- --llm "..."   # use the Grok/LLM planner
 *
 * Uses the real registry; if no agents are wired yet, falls back to a small
 * demo roster so the planner's behaviour is visible with zero spend.
 */
import 'dotenv/config';
import { Registry, type AgentEntryInput } from '@broker/registry';
import { RulePlanner, LlmPlanner, type Planner } from '../src/index';

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
    id: 'alphatrack',
    name: 'AlphaTrack',
    category: 'data-analytics',
    description: 'Tracks top Binance traders',
    capabilities: ['binance', 'trader-tracking', 'trading-signals'],
    inputHint: 'a trader handle',
    serviceId: 'demo_alpha',
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
];

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const useLlm = argv.includes('--llm');
  const goal = argv
    .filter((a) => a !== '--llm' && a !== '--')
    .join(' ')
    .trim();

  if (!goal) {
    console.error('Usage: pnpm plan "<goal>"  [--llm]');
    process.exitCode = 1;
    return;
  }

  const real = Registry.load();
  const usingDemo = real.hireable().length === 0;
  const registry = usingDemo ? Registry.load(DEMO_ROSTER) : real;

  let planner: Planner;
  if (useLlm) {
    const { safeLoadConfig } = await import('@broker/config');
    const parsed = safeLoadConfig();
    if (!parsed.success || !parsed.data.llmApiKey) {
      console.error('✖ --llm needs LLM_API_KEY in .env (xAI/Grok key).');
      process.exitCode = 1;
      return;
    }
    planner = new LlmPlanner({
      apiKey: parsed.data.llmApiKey,
      baseUrl: parsed.data.llmBaseUrl,
      model: parsed.data.llmModel,
    });
  } else {
    planner = new RulePlanner();
  }

  const plan = await planner.plan(goal, registry);

  console.log('Broker · plan');
  console.log('──────────────');
  console.log(`Goal:     ${plan.goal}`);
  console.log(
    `Strategy: ${plan.strategy}${usingDemo ? '  (demo roster - no agents wired yet)' : ''}`,
  );
  console.log(`Est cost: ${plan.estCostUsdc.toFixed(2)} USDC · ${plan.steps.length} step(s)`);
  console.log('──────────────');
  if (plan.steps.length === 0) {
    console.log('(no matching agents)');
  }
  for (const step of plan.steps) {
    const deps = step.dependsOn.length ? ` ← ${step.dependsOn.join(', ')}` : '';
    console.log(`${step.id}${deps}  ${step.agentId} (${step.serviceId})`);
    console.log(`     reason: ${step.reason}`);
    console.log(`     send:   ${step.requirements}`);
  }
  console.log('\n✅ Phase 4 proof: planner produced a plan.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
