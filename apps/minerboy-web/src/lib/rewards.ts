/**
 * Frontend reward tier system for MinerBoy
 * Shared with backend for consistency
 */

export const TIER_NAMES = [
  "Trash Hash",      // 0
  "Meh Hash",        // 1
  "Basic Batch",     // 2
  "Decent Drip",     // 3
  "Solid Shard",     // 4
  "Great Hash",      // 5
  "Mega Hash",       // 6
  "Juicy Jolt",      // 7
  "Hashtastic",      // 8
  "Epic Hash",       // 9
  "Mythical Hash",   // 10 (a)
  "Zesty Zap",       // 11 (b)
  "Magic Mix",       // 12 (c)
  "Monster Mash",    // 13 (d)
  "Hashtalavista, Baby", // 14 (e)
  "Hashalicious"     // 15 (f)
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
 * @returns Display label like "64 ABIT"
 */
export function createRewardLabel(powHash: `0x${string}`, amountWei: bigint | string, decimals = 18): string {
  const amount = formatAmount(amountWei, decimals);
  return `${amount} ABIT`;
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

