import * as shared from '../../shared/src/mining';

export type DifficultyOverride = Partial<shared.EpochDifficulty> | null;

let currentOverride: DifficultyOverride = null;

export function setDifficultyOverride(o: DifficultyOverride) {
  currentOverride = o;
}

export function getDifficultyOverride(): DifficultyOverride {
  return currentOverride;
}
