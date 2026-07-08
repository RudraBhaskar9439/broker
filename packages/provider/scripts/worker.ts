/**
 * Phase 6 - run Broker's in-house worker (provider) agent.
 *
 *   pnpm worker
 *
 * Uses WORKER_SDK_KEY. Auto-accepts negotiations and delivers LLM-generated
 * results (Groq) so Broker can hire it reliably. Keep this running in one
 * terminal while `pnpm run:goal --live` runs in another.
 */
import 'dotenv/config';
import { safeLoadConfig } from '@broker/config';
import { createLogger } from '@broker/logger';
import { createAgentClient } from '@broker/croo-client';
import { runProvider, llmHandler, echoHandler } from '../src/index';

async function main(): Promise<void> {
  const parsed = safeLoadConfig();
  if (!parsed.success) {
    console.error('✖ Invalid .env');
    process.exitCode = 1;
    return;
  }
  const config = parsed.data;
  if (!config.workerSdkKey) {
    console.error('✖ Set WORKER_SDK_KEY in .env (the worker agent’s API key).');
    process.exitCode = 1;
    return;
  }

  const logger = createLogger({ name: 'worker', level: config.logLevel });
  // A client authenticated as the worker agent, not Broker.
  const client = createAgentClient({ ...config, crooSdkKey: config.workerSdkKey }, { logger });

  const handle = config.llmApiKey
    ? llmHandler({ apiKey: config.llmApiKey, baseUrl: config.llmBaseUrl, model: config.llmModel })
    : echoHandler('scout');

  console.log('Broker · worker (provider)');
  console.log(`handler: ${config.llmApiKey ? `LLM (${config.llmModel})` : 'echo'}`);

  const stop = await runProvider({
    client,
    handle,
    logger,
    onEvent: (e) => {
      if (e.type === 'accepted') console.log(`✔ accepted negotiation ${e.negotiationId}`);
      else if (e.type === 'delivered') console.log(`📦 delivered order ${e.orderId}`);
      else if (e.type === 'completed') console.log(`✅ completed order ${e.orderId}`);
      else console.log(`✖ ${e.stage} error (${e.id}): ${e.error}`);
    },
  });

  console.log('Listening... press Ctrl+C to stop.\n');
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
