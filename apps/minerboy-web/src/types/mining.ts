export type Hex = `0x${string}`;

export type Rule = 'suffix';

export interface MiningJob {
  // required by UI/worker
  id: string;              // same as jobId
  jobId: string;
  data: `0x${string}`;
  nonce: number;           // numeric start (0 if absent)

  // difficulty/target
  target: string;          // "000000" (hash must end with this suffix)
  targetBits: number;      // target.length * 4
  difficultyZeros: number; // target.length
  difficultyBits: number;  // same as targetBits
  bits: number;            // alias for older code

  rule: Rule;              // "suffix"

  // misc
  height: number;          // 0 if N/A
  ttlMs: number;           // ms
  expiresAt: number;       // epoch ms
}