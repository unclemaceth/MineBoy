export type Hex = `0x${string}`;

// This is what your worker/UI consume internally
export interface Job {
  jobId: string;
  data: `0x${string}`;
  suffix: string;                           // always present internally
  difficulty: { zeros: number; suffix: string };
  nonce: number;                            // numeric counter start (required)
  height: number;                           // default 0 if missing
  ttlMs: number;                            // default 0 if missing
  expiresAt: number;                        // Date.now()+ttlMs fallback
}
