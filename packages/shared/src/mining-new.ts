// ----- types -----
export type MiningRule = 'suffix' | 'bits';

export type EpochDifficulty =
  | { rule: 'suffix'; suffix: string; epoch: number }
  | { rule: 'bits'; difficultyBits: number; epoch: number };

// ----- difficulty plan -----
// epoch 0..N -> suffix '00', '000', '0000', then switch to trailing-bit checks
export function getDifficultyForEpoch(epoch: number): EpochDifficulty {
  if (epoch <= 0) return { rule: 'suffix', suffix: '00', epoch };
  if (epoch === 1) return { rule: 'suffix', suffix: '000', epoch };
  if (epoch === 2) return { rule: 'suffix', suffix: '0000', epoch };
  // beyond that, move to bit-based difficulty (example: 18 trailing zero bits)
  return { rule: 'bits', difficultyBits: 18, epoch };
}

// helper for legacy UI text or quick display
export function getSuffixForEpoch(epoch: number): string {
  const d = getDifficultyForEpoch(epoch);
  if (d.rule === 'suffix') return d.suffix;
  // approximate equivalent nibble suffix for display only
  const nibbles = Math.ceil((d.difficultyBits ?? 0) / 4);
  return '0'.repeat(Math.max(0, nibbles));
}
