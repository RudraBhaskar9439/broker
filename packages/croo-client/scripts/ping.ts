/**
 * Phase 1 proof gate.
 *
 * Verifies that Broker can talk to the CROO network with the configured
 * credentials: authenticates the SDK key, opens the WebSocket event stream,
 * and prints the agent's on-chain USDC balance on Base.
 *
 *   pnpm ping
 */
import 'dotenv/config';
import { safeLoadConfig } from '@broker/config';
import { createLogger } from '@broker/logger';
import { createAgentClient, probeConnection, getUsdcBalance, isUnauthorized } from '../src/index';

function fail(message: string): void {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const parsed = safeLoadConfig();
  if (!parsed.success) {
    fail('Configuration invalid — copy .env.example → .env and fill it in:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return;
  }
  const config = parsed.data;

  console.log('Broker · CROO connection check');
  console.log('────────────────────────────────');
  console.log(`API:  ${config.crooApiUrl}`);
  console.log(`WS:   ${config.crooWsUrl}`);

  // Quiet logger: the SDK logs the WS URL (which embeds the key) at info level.
  const client = createAgentClient(config, {
    logger: createLogger({ name: 'croo-client', level: 'warn' }),
  });

  try {
    const probe = await probeConnection(client);
    console.log(`✔ SDK key authenticated (existing orders: ${probe.orderCount})`);
    console.log('✔ WebSocket event stream connected');
  } catch (err) {
    if (isUnauthorized(err)) {
      fail('SDK key rejected (401). Check CROO_SDK_KEY in .env.');
    } else {
      fail(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (config.walletAddress) {
    try {
      const balance = await getUsdcBalance(config.walletAddress, config.baseRpcUrl);
      console.log(`Wallet:  ${config.walletAddress}`);
      console.log(`Balance: ${balance.formatted} USDC (Base)`);
      if (balance.raw === 0n) {
        console.log('⚠ Balance is 0 — fund the wallet before Phase 2 (paid hires).');
      }
    } catch (err) {
      fail(`Could not read USDC balance: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
  } else {
    console.log('… set BROKER_WALLET_ADDRESS in .env to display the USDC balance');
  }

  console.log('\n✅ Phase 1 proof: Broker is connected to CROO.');
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
