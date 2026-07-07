import type { AgentEntryInput } from './schema';

/**
 * Curated roster of CROO Agent Store agents Maestro can orchestrate.
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
    inputHint: 'A 0x Polymarket proxy/smart wallet address.',
    priceUsdc: 0.1,
    source: 'third-party',
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
];
