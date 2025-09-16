export type Hex = `0x${string}`;

export interface Job {
  // canonical
  id: string;
  data: string;
  target: string;

  // optional/canonical
  height?: number;
  difficulty?: number;
  nonceStart?: number;
  nonceEnd?: number;
  expiresAt?: number;

  // legacy compat (existing call-sites expect these – keep optional)
  jobId?: string;
  nonce?: number;
  suffix?: string;
  rule?: "suffix" | "bits";
  difficultyBits?: number;
  targetBits?: number;
  bits?: number; // read-only compat
}
