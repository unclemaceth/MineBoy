/**
 * Frontend reward tier system for MinerBoy
 * Shared with backend for consistency
 */

export const TIER_NAMES = [
  "Hashalicious",    // 0 (128 MNESTR) - 0x0... (hardest)
  "Hashtalavista, Baby", // 1 (120 MNESTR) - 0x1...
  "Monster Mash",    // 2 (112 MNESTR) - 0x2...
  "Magic Mix",       // 3 (104 MNESTR) - 0x3...
  "Zesty Zap",       // 4 (96 MNESTR) - 0x4...
  "Mythical Hash",   // 5 (88 MNESTR) - 0x5...
  "Epic Hash",       // 6 (80 MNESTR) - 0x6...
  "Hashtastic",      // 7 (72 MNESTR) - 0x7...
  "Juicy Jolt",      // 8 (64 MNESTR) - 0x8...
  "Mega Hash",       // 9 (56 MNESTR) - 0x9...
  "Great Hash",      // 10 (48 MNESTR) - 0xa...
  "Solid Shard",     // 11 (40 MNESTR) - 0xb...
  "Decent Drip",     // 12 (32 MNESTR) - 0xc...
  "Basic Batch",     // 13 (24 MNESTR) - 0xd...
  "Meh Hash",        // 14 (16 MNESTR) - 0xe...
  "Trash Hash"       // 15 (8 MNESTR) - 0xf... (easiest)
];

/**
 * Derive tier from the first nibble of a PoW hash
 * @param powHash The PoW hash (0x... format)
 * @returns Tier number (0-15)
 */
export function tierFromHash(powHash: `0x${string}`): number {
  // First hex char after 0x
  return parseInt(powHash[2], 16);
}

/**
 * Get tier name from tier number
 * @param tier Tier number (0-15)
 * @returns Human-readable tier name
 */
export function getTierName(tier: number): string {
  if (tier < 0 || tier > 15) {
    throw new Error(`Invalid tier: ${tier}. Must be 0-15.`);
  }
  return TIER_NAMES[tier];
}

/**
 * Get tier info from a PoW hash
 * @param powHash The PoW hash (0x... format)
 * @returns Object with tier number and name
 */
export function getTierInfo(powHash: `0x${string}`): { tier: number; name: string } {
  const tier = tierFromHash(powHash);
  const name = getTierName(tier);
  return { tier, name };
}

/**
 * Format amount for display
 * @param amountWei Amount in wei (BigInt or string)
 * @param decimals Token decimals (default 18)
 * @returns Formatted amount string
 */
export function formatAmount(amountWei: bigint | string, decimals = 18): string {
  const amount = typeof amountWei === 'string' ? BigInt(amountWei) : amountWei;
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  // Format with up to 6 decimal places
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmed = remainderStr.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Create a display label for a reward
 * @param powHash The PoW hash
 * @param amountWei The reward amount in wei
 * @param decimals Token decimals (default 18)
 * @returns Display label like "64 MNESTR"
 */
export function createRewardLabel(powHash: `0x${string}`, amountWei: bigint | string, decimals = 18): string {
  const amount = formatAmount(amountWei, decimals);
  return `${amount} MNESTR`;
}

/**
 * Decorate a found hash with tier information
 * @param powHash The PoW hash
 * @param amountWei The reward amount in wei
 * @param decimals Token decimals (default 18)
 * @returns Object with all tier and reward info
 */
export function decorateFoundHash(powHash: `0x${string}`, amountWei: bigint | string, decimals = 18) {
  const { tier, name } = getTierInfo(powHash);
  const amountLabel = createRewardLabel(powHash, amountWei, decimals);
  
  return {
    powHash,
    tier,
    tierName: name,
    amountLabel,
    amountWei: typeof amountWei === 'string' ? amountWei : amountWei.toString()
  };
}

