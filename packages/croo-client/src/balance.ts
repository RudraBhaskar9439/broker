import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { BASE_USDC, DEFAULT_BASE_RPC, USDC_DECIMALS } from './constants';

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

export interface TokenBalance {
  /** Raw on-chain integer amount (base units). */
  raw: bigint;
  /** Human-readable amount, scaled by the token's decimals. */
  formatted: string;
  decimals: number;
}

/** Read an ERC-20 balance for `walletAddress` on Base via JSON-RPC. */
export async function getErc20Balance(
  walletAddress: string,
  tokenAddress: string,
  opts: { rpcURL?: string; decimals?: number } = {},
): Promise<TokenBalance> {
  const provider = new JsonRpcProvider(opts.rpcURL ?? DEFAULT_BASE_RPC);
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  const balanceOf = contract.getFunction('balanceOf');
  const raw = (await balanceOf(walletAddress)) as bigint;
  const decimals = opts.decimals ?? 18;
  return { raw, formatted: formatUnits(raw, decimals), decimals };
}

/** Convenience: read a wallet's USDC balance on Base. */
export function getUsdcBalance(walletAddress: string, rpcURL?: string): Promise<TokenBalance> {
  return getErc20Balance(walletAddress, BASE_USDC, { rpcURL, decimals: USDC_DECIMALS });
}
