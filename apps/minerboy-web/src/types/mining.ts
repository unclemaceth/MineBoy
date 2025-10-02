export type Hex = `0x${string}`;

// The shape your UI + worker use INTERNALLY
export type MiningJob = {
  // required
  id: string;
  data: `0x${string}`;
  target: string;                    // e.g. "000000" (DEPRECATED: use allowedSuffixes)

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
  
  // ANTI-BOT FIELDS (REQUIRED for STRICT mode)
  counterStart?: number;             // inclusive start of counter window
  counterEnd?: number;               // exclusive end of counter window
  maxHps?: number;                   // target hashrate (e.g., 5000)
  allowedSuffixes?: string[];        // array of valid hash suffixes
};