/**
 * Phase 3 proof gate.
 *
 * Static (default, $0): validates the roster and prints a summary.
 * Live (--live): confirms each hireable agent's serviceId is reachable by
 * opening a negotiation (free - no payment) that is left to expire unpaid.
 *
 *   pnpm registry:verify
 *   pnpm registry:verify -- --live
 */
import 'dotenv/config';
import { Registry } from '../src/index';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  const registry = Registry.load();
  const all = registry.all();
  const hireable = registry.hireable();

  console.log('Broker · registry');
  console.log('──────────────────');
  console.log(`${pad('ID', 20)} ${pad('CATEGORY', 18)} ${pad('SRC', 12)} EN  SERVICE`);
  for (const e of all) {
    console.log(
      `${pad(e.id, 20)} ${pad(e.category, 18)} ${pad(e.source, 12)} ${e.enabled ? '✔ ' : '· '} ${
        e.serviceId || '(unwired)'
      }`,
    );
  }
  console.log('──────────────────');
  console.log(`Total: ${all.length} · hireable: ${hireable.length}`);
  console.log(`Capabilities: ${registry.capabilities().join(', ') || '(none yet)'}`);

  if (!live) {
    console.log('\n✅ Phase 3 proof: registry validates. (Run with --live to probe serviceIds.)');
    return;
  }

  if (hireable.length === 0) {
    console.log('\nℹ No hireable (enabled + wired) agents to probe yet.');
    return;
  }

  const { safeLoadConfig } = await import('@broker/config');
  const { createAgentClient } = await import('@broker/croo-client');
  const { createLogger } = await import('@broker/logger');

  const parsed = safeLoadConfig();
  if (!parsed.success) {
    console.error('\n✖ --live needs a valid .env');
    process.exitCode = 1;
    return;
  }
  const client = createAgentClient(parsed.data, {
    logger: createLogger({ name: 'registry', level: 'warn' }),
  });

  console.log('\nProbing serviceIds (free negotiations, left to expire) …');
  let reachable = 0;
  for (const agent of hireable) {
    try {
      await client.negotiateOrder({
        serviceId: agent.serviceId,
        requirements: 'reachability probe',
      });
      console.log(`  ✔ ${agent.id} (${agent.serviceId})`);
      reachable += 1;
    } catch (err) {
      console.log(`  ✖ ${agent.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nReachable: ${reachable}/${hireable.length}`);
  if (reachable < hireable.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
