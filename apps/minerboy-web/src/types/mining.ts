export type Hex = `0x${string}`;

// The shape your UI + worker use INTERNALLY
export type MiningJob = {
  // required
  id: string;
  data: `0x${string}`;
  target: string;                    // e.g. "000000"

  // optional metadata
  rule?: 'suffix';
  bits?: number;
  targetBits?: number;
  height?: number;
  nonce?: `0x${string}`;

  // --- Back-compat so page.tsx & overlays compile ---
  // some code still reads job.jobId
  jobId?: string;                    // alias of id

  // some code reads job.expiresAt for TTL display
  expiresAt?: number;                // epoch ms (Date.now() based)

  // keep raw TTLs if backend sends them
  ttlMs?: number;
  ttlSec?: number;
};