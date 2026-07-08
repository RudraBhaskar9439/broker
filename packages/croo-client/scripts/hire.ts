/**
 * Phase 2 proof gate.
 *
 * Hires one real agent on the CROO Agent Store, pays it in USDC on Base, and
 * prints the delivered result plus the on-chain transaction hash.
 *
 *   pnpm croo:hire -- --service <serviceId> --req "your task"
 *
 * --service defaults to CROO_TARGET_SERVICE_ID from .env.
 */
import 'dotenv/config';
import { formatUnits } from 'ethers';
import { safeLoadConfig } from '@broker/config';
import { createLogger } from '@broker/logger';
import {
  createAgentClient,
  hire,
  HireError,
  getUsdcBalance,
  isInsufficientBalance,
  USDC_DECIMALS,
} from '../src/index';

interface Args {
  service?: string;
  req?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--service') args.service = argv[++i];
    else if (flag === '--req') args.req = argv[++i];
  }
  return args;
}

function fail(message: string): void {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const parsed = safeLoadConfig();
  if (!parsed.success) {
    fail('Configuration invalid - fill in .env first.');
    return;
  }
  const config = parsed.data;

  const args = parseArgs(process.argv.slice(2));
  const serviceId = args.service ?? process.env.CROO_TARGET_SERVICE_ID;
  const requirements = args.req ?? 'Broker test hire - please return your standard output.';

  if (!serviceId) {
    fail('No service id. Pass --service <id> or set CROO_TARGET_SERVICE_ID in .env.');
    return;
  }

  const client = createAgentClient(config, {
    logger: createLogger({ name: 'croo-client', level: 'warn' }),
  });

  console.log('Broker · hire');
  console.log('──────────────');
  console.log(`Service:      ${serviceId}`);
  console.log(`Requirements: ${requirements}`);

  if (config.walletAddress) {
    const balance = await getUsdcBalance(config.walletAddress, config.baseRpcUrl);
    console.log(`Balance:      ${balance.formatted} USDC`);
    if (balance.raw === 0n) {
      fail('Wallet has 0 USDC. Fund BROKER_WALLET_ADDRESS on Base before hiring.');
      return;
    }
  }

  console.log('\n⏳ negotiating → paying → awaiting delivery …\n');

  try {
    const result = await hire(
      client,
      { serviceId, requirements },
      { acceptTimeoutMs: 120_000, deliverTimeoutMs: 600_000 },
    );
    const price = formatUnits(result.price || '0', USDC_DECIMALS);

    console.log('✅ Hire complete');
    console.log(`   order id:   ${result.orderId}`);
    console.log(`   price:      ${price} USDC`);
    console.log(`   pay tx:     ${result.payTxHash}`);
    console.log(`   basescan:   https://basescan.org/tx/${result.payTxHash}`);
    console.log(`   elapsed:    ${(result.elapsedMs / 1000).toFixed(1)}s`);
    console.log(`   content #:  ${result.contentHash}`);
    console.log('\n── deliverable ─────────────────────────────');
    if (result.json !== undefined) {
      console.log(JSON.stringify(result.json, null, 2));
    } else {
      console.log(result.text ?? '(no text deliverable)');
    }
    console.log('────────────────────────────────────────────');
    console.log('\n✅ Phase 2 proof: real A2A hire settled on-chain.');
  } catch (err) {
    if (isInsufficientBalance(err)) {
      fail('Insufficient USDC balance to pay for this order.');
    } else if (err instanceof HireError) {
      fail(`Hire failed: ${err.message}`);
    } else {
      fail(err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
