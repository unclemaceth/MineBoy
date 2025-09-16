export type Hex = `0x${string}`;

export interface Job {
  id: string;           // opaque job id
  data: Hex;            // header / seed / work data
  target: Hex;          // difficulty target
  nonceStart?: number;
  nonceEnd?: number;
  height?: number;      // optional — not every backend sends it
  difficulty?: number;  // optional
  // backend compatibility fields
  jobId?: string;       // legacy field
  algo?: 'sha256-suffix';
  charset?: 'hex';
  nonce?: string;       // 0x...
  expiresAt?: number;   // epoch ms
  rule?: 'suffix';
  suffix?: string;      // required suffix (e.g., "00", "000", "0000")
  epoch?: number;
  ttlMs?: number;
}
