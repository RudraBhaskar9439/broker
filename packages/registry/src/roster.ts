import type { AgentEntryInput } from './schema';

/**
 * Curated roster of CROO Agent Store agents Broker can orchestrate.
 *
 * Third-party entries are seeded from the live store but ship `enabled: false`
 * with an empty `serviceId` until a real service id is wired in — the planner
 * ignores them until then, so committing the roster never implies a paid hire.
 * In-house specialist agents (Phase 6) are added here with `source: 'in-house'`
 * once registered, priced at the minimum so hires recycle USDC between our own
 * wallets.
 */
export const defaultRoster: AgentEntryInput[] = [
  {
    id: 'alphatrack',
    name: 'AlphaTrack',
    category: 'data-analytics',
    description: "Monitors top Binance traders' positions and surfaces real-time moves.",
    capabilities: ['binance', 'trader-tracking', 'trading-signals', 'market-intel'],
    inputHint: 'A trader handle/address or "top traders" to summarise.',
    priceUsdc: 0.1,
    source: 'third-party',
    enabled: false,
  },
  {
    id: 'polymarket-wallet',
    name: 'Polymarket Smart Wallet Tracker',
    category: 'data-analytics',
    description: 'Turns a Polymarket proxy/smart wallet address into structured intelligence.',
    capabilities: ['polymarket', 'wallet-analysis', 'onchain-intel', 'prediction-markets'],
    inputHint: 'JSON: { "wallet_address": "0x… Polymarket proxy/smart wallet" }',
    serviceId: '022c38ad-0be9-4ee1-8f76-d645cb182010',
    priceUsdc: 0.1,
    source: 'third-party',
    // Real serviceId, but this provider does not reliably auto-accept SDK
    // (A2A) negotiations, so it is left disabled for live runs.
    enabled: false,
  },
  {
    id: 'hyperliquid-vault',
    name: 'Hyperliquid Vault Strategy Intelligence',
    category: 'data-analytics',
    description:
      "On-demand Hyperliquid vault intelligence and strategy review of a vault's metrics.",
    capabilities: ['hyperliquid', 'vault-analysis', 'defi', 'strategy'],
    inputHint: 'A Hyperliquid vault address.',
    priceUsdc: 0.1,
    source: 'third-party',
    enabled: false,
  },
  {
    id: 'veris',
    name: 'VERIS',
    category: 'research-report',
    description: 'Trust-infrastructure agent performing due diligence on Web3 projects and agents.',
    capabilities: ['due-diligence', 'trust', 'research', 'verification'],
    inputHint: 'A project name, token, or address to run due diligence on.',
    priceUsdc: 0.1,
    source: 'third-party',
    enabled: false,
  },
  {
    id: 'swapgod',
    name: 'SwapGod',
    category: 'defi-trading',
    description: 'Executes swaps of any ERC-20 to any ERC-20 on Aerodrome (Base mainnet).',
    capabilities: ['swap', 'execution', 'defi-trading', 'aerodrome'],
    inputHint: 'A swap intent: fromToken, toToken, amount.',
    priceUsdc: 0.1,
    source: 'third-party',
    enabled: false,
  },
  {
    // Broker's in-house worker (Phase 6) — the reliable, LLM-backed agent
    // Broker hires. Live-verified: real on-chain A2A order settled on Base.
    id: 'scout',
    name: 'Scout',
    category: 'research-report',
    description: 'In-house analyst: answers an analysis question about a wallet, token, or topic.',
    capabilities: ['research', 'analysis', 'wallet-analysis', 'trust', 'summary', 'brief'],
    inputHint: 'A free-text question or topic to analyse.',
    serviceId: '8b6f9833-09e7-4081-bda4-25932e3ba080',
    priceUsdc: 0.01,
    source: 'in-house',
    enabled: true,
  },
  {
    // Verified live: accepts SDK A2A hires (probed 2026-07-08).
    id: 'gauntlet',
    name: 'Gauntlet · Quick Safety Check',
    category: 'dev-code',
    description: 'Security safety check for a contract/token address.',
    capabilities: ['security', 'safety', 'audit', 'contract', 'risk'],
    inputHint: 'A contract/token address to check.',
    serviceId: '1b6b6165-ca0d-4cf9-9206-8fa34cb40d2f',
    priceUsdc: 0.05,
    source: 'third-party',
    enabled: false,
  },
  {
    // Verified live: accepts SDK A2A hires (probed 2026-07-08).
    id: 'agentstools-onchain',
    name: 'agentstools · Onchain Code',
    category: 'defi-trading',
    description: 'On-chain code analysis (is_contract, code size/hash) for a contract address.',
    capabilities: ['onchain', 'code', 'contract', 'bytecode', 'analysis'],
    // Third-party schema agent: requires JSON with an `address` field.
    inputHint: 'JSON object exactly: {"address": "0x… the contract address to analyse"}',
    serviceId: '76c36947-f2c6-4b5f-afaa-31eb773b6abe',
    priceUsdc: 0.05,
    source: 'third-party',
    enabled: true,
  },
];
