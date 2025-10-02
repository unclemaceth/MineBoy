/**
 * Shared reward tier system for MinerBoy
 * Used by both backend and frontend
 */

export const TIER_NAMES = [
  "Trash Hash",      // 0 (8 ABIT)
  "Meh Hash",        // 1 (16 ABIT)
  "Basic Batch",     // 2 (24 ABIT)
  "Decent Drip",     // 3 (32 ABIT)
  "Solid Shard",     // 4 (40 ABIT)
  "Great Hash",      // 5 (48 ABIT)
  "Mega Hash",       // 6 (56 ABIT)
  "Juicy Jolt",      // 7 (64 ABIT)
  "Hashtastic",      // 8 (72 ABIT)
  "Epic Hash",       // 9 (80 ABIT)
  "Mythical Hash",   // 10 (88 ABIT)
  "Zesty Zap",       // 11 (96 ABIT)
  "Magic Mix",       // 12 (104 ABIT)
  "Monster Mash",    // 13 (112 ABIT)
  "Hashtalavista, Baby", // 14 (120 ABIT)
  "Hashalicious"     // 15 (128 ABIT)
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

/**
 * Build allowed suffix patterns for a given number of zeros
 * @param zeros Number of zeros (5 or 6)
 * @param count How many patterns to allow
 * @returns Array of allowed suffix patterns
 */
function buildAllowedSuffixes(zeros: number, count: number): string[] {
  const digits = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
  const patterns: string[] = [];
  
  for (let i = 0; i < Math.min(count, 16); i++) {
    patterns.push(digits[i].repeat(zeros));
  }
  
  return patterns;
}

/**
 * Get difficulty suffix based on active miners count (LEGACY - kept for compatibility)
 * @param activeMiners Number of active miners
 * @returns Suffix string for difficulty
 * @deprecated Use getDifficultyForActiveMiners instead
 */
export function getDifficultySuffixForActiveMiners(activeMiners: number): string {
  // Return first suffix from new system for backward compatibility
  const diff = getDifficultyForActiveMiners(activeMiners);
  return diff.allowedSuffixes[0];
}

/**
 * Get difficulty info for active miners using allowed suffix sets
 * @param activeMiners Number of active miners
 * @returns Difficulty configuration with allowed suffixes, lease size, and TTL
 */
export function getDifficultyForActiveMiners(activeMiners: number) {
  if (activeMiners < 50) {
    // CASUAL: 5 zeros, all 16 patterns (~13s expected @ 5k H/s)
    return {
      zeros: 5,
      suffix: '00000', // LEGACY: kept for compatibility
      allowedSuffixes: buildAllowedSuffixes(5, 16), // All 16 patterns
      leaseHashes: 100_000,  // 20 seconds @ 5k H/s
      ttlMs: 256_000,        // 256 seconds total
      activeMiners
    };
  }
  
  if (activeMiners < 100) {
    // TRICKY: 5 zeros, 5 patterns (~42s expected @ 5k H/s)
    return {
      zeros: 5,
      suffix: '00000', // LEGACY: kept for compatibility
      allowedSuffixes: buildAllowedSuffixes(5, 5), // 5 patterns
      leaseHashes: 250_000,  // 50 seconds @ 5k H/s
      ttlMs: 512_000,        // 512 seconds total
      activeMiners
    };
  }
  
  if (activeMiners < 200) {
    // SERIOUS: 5 zeros, 1 pattern (~3.5 min expected @ 5k H/s)
    return {
      zeros: 5,
      suffix: '00000', // LEGACY: kept for compatibility
      allowedSuffixes: buildAllowedSuffixes(5, 1), // Only 00000
      leaseHashes: 1_000_000,  // 200 seconds (~3.3 min) @ 5k H/s
      ttlMs: 1024_000,         // 1024 seconds total
      activeMiners
    };
  }
  
  // BRUTAL: 6 zeros, 3 patterns (~19 min expected @ 5k H/s)
  return {
    zeros: 6,
    suffix: '000000', // LEGACY: kept for compatibility
    allowedSuffixes: buildAllowedSuffixes(6, 3), // 3 patterns
    leaseHashes: 6_000_000,  // 1200 seconds (20 min) @ 5k H/s
    ttlMs: 2048_000,         // 2048 seconds total
    activeMiners
  };
}
