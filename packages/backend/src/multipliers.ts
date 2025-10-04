/**
 * @file multipliers.ts
 * @description NFT-based reward multiplier system
 * Checks user's NFT holdings and calculates reward bonuses
 */

import { getNFTBalance } from './alchemy.js';

// Multiplier configuration
interface MultiplierConfig {
  nftContract: string;
  minBalance: number;
  multiplierBps: number; // 10000 = 1x, 12000 = 1.2x
  name: string;
}

// Hardcoded multiplier config (mirrors on-chain V3 router config)
// TODO: Optionally fetch this from router contract for perfect sync
const MULTIPLIER_CONFIG: MultiplierConfig[] = [
  {
    nftContract: '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA', // NAPC
    minBalance: 1,
    multiplierBps: 12000, // 1.2x
    name: 'NAPC',
  },
  {
    nftContract: '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA', // NAPC
    minBalance: 10,
    multiplierBps: 15000, // 1.5x
    name: 'NAPC Whale',
  },
];

export interface MultiplierResult {
  multiplier: number; // Final multiplier (e.g., 1.2, 1.5)
  multiplierBps: number; // Basis points (e.g., 12000, 15000)
  details: string[]; // Human-readable details
  nftBalances: Map<string, number>; // NFT contract -> balance
}

/**
 * Calculate multiplier for a user based on their NFT holdings
 * @param walletAddress User's wallet address
 * @returns Multiplier result with details
 */
export async function calculateMultiplier(
  walletAddress: string
): Promise<MultiplierResult> {
  const details: string[] = [];
  const nftBalances = new Map<string, number>();

  let highestMultiplierBps = 10000; // Start at 1x
  let appliedMultiplier = '';

  // Get unique NFT contracts
  const uniqueContracts = Array.from(
    new Set(MULTIPLIER_CONFIG.map(m => m.nftContract))
  );

  // Fetch all NFT balances in parallel
  await Promise.all(
    uniqueContracts.map(async (contract) => {
      const balance = await getNFTBalance(walletAddress, contract);
      nftBalances.set(contract.toLowerCase(), balance);
    })
  );

  // Check each multiplier config and find the highest one the user qualifies for
  for (const config of MULTIPLIER_CONFIG) {
    const balance = nftBalances.get(config.nftContract.toLowerCase()) || 0;

    if (balance >= config.minBalance) {
      details.push(`${config.name}: owns ${balance} (requires ${config.minBalance})`);

      // Apply highest multiplier
      if (config.multiplierBps > highestMultiplierBps) {
        highestMultiplierBps = config.multiplierBps;
        appliedMultiplier = config.name;
      }
    }
  }

  // Calculate final multiplier
  const multiplier = highestMultiplierBps / 10000;

  // Add summary
  if (highestMultiplierBps > 10000) {
    details.push(`✅ Applied: ${appliedMultiplier} (${multiplier}x)`);
  } else {
    details.push('No multiplier applied (base 1x)');
  }

  console.log(`[MULTIPLIER] ${walletAddress.slice(0, 8)}... -> ${multiplier}x (${highestMultiplierBps} bps)`);
  details.forEach(d => console.log(`[MULTIPLIER]   ${d}`));

  return {
    multiplier,
    multiplierBps: highestMultiplierBps,
    details,
    nftBalances,
  };
}

/**
 * Calculate expected reward after multiplier
 * @param baseReward Base reward amount (before multiplier)
 * @param multiplierBps Multiplier in basis points
 * @returns Final reward amount
 */
export function applyMultiplier(
  baseReward: bigint,
  multiplierBps: number
): bigint {
  return (baseReward * BigInt(multiplierBps)) / 10000n;
}

/**
 * Get multiplier configuration (for debugging/display)
 */
export function getMultiplierConfig(): MultiplierConfig[] {
  return MULTIPLIER_CONFIG;
}

