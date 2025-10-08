/**
 * Frontend reward tier system for MinerBoy
 * Shared with backend for consistency
 */

export const TIER_NAMES = [
  "Trash Hash",      // 0 (0 MNESTR) - Disabled
  "Meh Hash",        // 1 (2 MNESTR)
  "Basic Batch",     // 2 (4 MNESTR)
  "Decent Drip",     // 3 (8 MNESTR)
  "Solid Shard",     // 4 (15 MNESTR)
  "Great Hash",      // 5 (25 MNESTR)
  "Mega Hash",       // 6 (35 MNESTR)
  "Juicy Jolt",      // 7 (45 MNESTR)
  "Hashtastic",      // 8 (55 MNESTR)
  "Epic Hash",       // 9 (65 MNESTR)
  "Mythical Hash",   // 10 (75 MNESTR)
  "Zesty Zap",       // 11 (90 MNESTR)
  "Magic Mix",       // 12 (110 MNESTR)
  "Monster Mash",    // 13 (140 MNESTR)
  "Hashtalavista, Baby", // 14 (180 MNESTR)
  "Hashalicious"     // 15 (230 MNESTR) - Hardest
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

