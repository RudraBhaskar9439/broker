/**
 * Live discovery proof.
 *
 *   pnpm discover
 *
 * Pulls hireable agents straight from the CROO store's public API (no auth, no
 * transactions) and prints them as Maestro's dynamic roster.
 */
import { fetchStoreAgents } from '../src/index';

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main(): Promise<void> {
  console.log('Maestro · live discovery (CROO public API)');
  console.log('──────────────────────────────────────────');
  const agents = await fetchStoreAgents({ maxAgents: 20, onlineOnly: true });
  console.log(`${pad('AGENT · SERVICE', 44)} ${pad('CATEGORY', 18)} PRICE   SERVICE ID`);
  for (const a of agents) {
    console.log(
      `${pad(a.name, 44)} ${pad(a.category, 18)} $${a.priceUsdc.toFixed(2).padStart(5)}  ${a.serviceId}`,
    );
  }
  console.log('──────────────────────────────────────────');
  console.log(`Discovered ${agents.length} hireable services — no keys, no transactions.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
