export type Job = {
  jobId: string;
  algo: 'sha256-suffix';
  charset: 'hex';
  nonce: string;        // 0x...
  expiresAt: number;    // epoch ms
  // difficulty
  rule: 'suffix';
  suffix: string;       // required suffix (e.g., "00", "000", "0000")
  epoch: number;
  ttlMs: number;
};
