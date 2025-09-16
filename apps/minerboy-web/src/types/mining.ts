export type Hex = `0x${string}`;

// Shape the miner/worker & UI expect
export type MiningJob = {
  id: string;                       // required
  data: `0x${string}`;              // required
  target: string;                   // required; e.g. "000000"
  rule?: 'suffix';
  bits?: number;
  targetBits?: number;
  height?: number;

  // Keep as string if you ever display it; the worker doesn't need it.
  nonce?: `0x${string}`;
};