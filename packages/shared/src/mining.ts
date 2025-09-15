export type MiningAlgo = 'sha256-suffix';

export type ClaimType = 'erc20' | 'erc721' | 'erc1155';

export type CartridgeStandard = 'erc721';

export interface CartridgeConfig {
  slug: string;
  name: string;
  chainId: number;
  standard: CartridgeStandard;
  contract: `0x${string}`;
  image?: string;
  mining: {
    algo: MiningAlgo;
    suffix: string;     // e.g. "ab17"
    charset: 'hex';
    difficulty?: number;
  };
  claim: {
    type: ClaimType;
    chainId: number;
    token: `0x${string}`;
    router?: `0x${string}` | null;
    id?: string | number; // for 1155 if needed
  };
}

export interface Job {
  jobId: string;
  algo: MiningAlgo;
  suffix: string;
  charset: 'hex';
  nonce: `0x${string}`;
  expiresAt: number; // epoch ms
  sig: `0x${string}`; // server signature over job payload
}

export interface OpenSessionReq {
  wallet: `0x${string}`;
  cartridge: { chainId: number; contract: `0x${string}`; tokenId: string };
  clientInfo?: Record<string, unknown>;
}

export interface OpenSessionRes {
  sessionId: string;
  job: Job;
  policy: { heartbeatSec: number; cooldownSec: number };
  claim: CartridgeConfig['claim'];
}

export interface ClaimReq {
  sessionId: string;
  jobId: string;
  preimage: string;       // exact input hashed by the worker
  hash: `0x${string}`;    // 32-byte hex
  steps: number;          // attempts during this job
  hr: number;             // hashes per second
}

export interface ClaimRes {
  ok: true;
  txHash?: `0x${string}`; // present if backend mints/sends
  to?: `0x${string}`;     // present if client should send prepared tx
  data?: `0x${string}`;
}

// EIP-712 Domain
export const EIP712_DOMAIN = {
  name: 'MinerBoyClaim',
  version: '1',
  chainId: 33111, // Curtis testnet
  verifyingContract: '' as `0x${string}` // Will be set to router address
};

// EIP-712 Types
export const EIP712_TYPES = {
  Claim: [
    { name: 'wallet', type: 'address' },
    { name: 'cartridge', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'rewardToken', type: 'address' },
    { name: 'rewardAmount', type: 'uint256' },
    { name: 'workHash', type: 'bytes32' },
    { name: 'attempts', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'expiry', type: 'uint64' }
  ]
};

// Claim struct matching Solidity
export interface ClaimStruct {
  wallet: `0x${string}`;
  cartridge: `0x${string}`;
  tokenId: string;
  rewardToken: `0x${string}`;
  rewardAmount: string;
  workHash: `0x${string}`;
  attempts: string;
  nonce: `0x${string}`;
  expiry: string;
}
