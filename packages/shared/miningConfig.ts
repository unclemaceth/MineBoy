export const miningTarget = {
  type: "suffix" as const,
  values: ["59517d556", "000000", "111111", "abc123"] // Multiple possible suffixes
};

export const miningConfig = {
  TARGET_HR: 2400,        // Target hash rate (H/s)
  TICK_MS: 60,           // Mining tick interval
  FOUND_EVERY_MS: 45000, // Average time to find hash (45s)
  EMA_ALPHA: 0.2,        // Hash rate smoothing factor
};

export type MiningState = 'idle' | 'mining' | 'found' | 'claiming';

export function endsWithAny(hash: string, suffixes: string[]): string | null {
  const cleanHash = hash.replace('0x', '').toLowerCase();
  for (const suffix of suffixes) {
    if (cleanHash.endsWith(suffix.toLowerCase())) {
      return suffix;
    }
  }
  return null;
}
