import { ethers } from 'ethers';
// Robust interop-safe import
import * as Mining from '../../shared/src/mining.js';
import * as Rewards from '../../shared/src/rewards.js';

const hashMeetsDifficulty =
  (Mining as any).hashMeetsDifficulty ??
  (Mining as any).default?.hashMeetsDifficulty;

if (typeof hashMeetsDifficulty !== 'function') {
  throw new Error('shared/mining is missing hashMeetsDifficulty');
}

import { ClaimReq, ClaimRes, ClaimStruct } from '../../shared/src/mining.js';
import { config } from './config.js';
import { SessionStore } from './sessionStore.js';
import { jobManager } from './jobs.js';
import { cartridgeRegistry } from './registry.js';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';
import { insertPendingClaim } from './db.js';
import { randomUUID } from 'crypto';

// Import job serializer from server
function hexlifyData(data: any): `0x${string}` {
  if (typeof data === 'string' && data.startsWith('0x')) return data as `0x${string}`;
  if (typeof data === 'string') return (`0x${Buffer.from(data, 'utf8').toString('hex')}`) as `0x${string}`;
  if (data instanceof Uint8Array) return (`0x${Buffer.from(data).toString('hex')}`) as `0x${string}`;
  if (Array.isArray(data)) return (`0x${Buffer.from(Uint8Array.from(data)).toString('hex')}`) as `0x${string}`;
  if (data?.bytes) return (`0x${Buffer.from(data.bytes).toString('hex')}`) as `0x${string}`;
  if (data?.dataHex) return data.dataHex as `0x${string}`;
  throw new Error('Unsupported job data type');
}

function serializeJob(job: any | null): any | null {
  if (!job) return null;
  
  // Ensure data is always present - use nonce for suffix-POW
  let dataHex: string;
  if (job.dataHex) {
    dataHex = job.dataHex;
  } else if (job.nonce) {
    dataHex = hexlifyData(job.nonce);
  } else if (job.data) {
    dataHex = hexlifyData(job.data);
  } else if (job.bytes) {
    dataHex = hexlifyData(job.bytes);
  } else {
    // Fallback - generate some default data
    dataHex = '0x48656c6c6f20576f726c64'; // "Hello World" in hex
  }
  
  return {
    id: job.jobId || job.id,
    jobId: job.jobId || job.id,
    data: dataHex,
    rule: job.rule || 'suffix',
    target: job.suffix || job.target || '000000',
    difficulty: job.difficultyBits || job.difficulty || 6,
    nonceStart: 0,
    ttlSec: job.ttlMs ? Math.ceil(job.ttlMs / 1000) : undefined,
    expiresAt: job.expiresAt,
  };
}

const EIP712_TYPES = {
  Claim: [
    { name: 'wallet',        type: 'address' },
    { name: 'cartridge',     type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'rewardToken',   type: 'address' },
    { name: 'rewardAmount',  type: 'uint256' },
    { name: 'workHash',      type: 'bytes32' },
    { name: 'attempts',      type: 'uint64'  },
    { name: 'nonce',         type: 'bytes32' },
    { name: 'expiry',        type: 'uint64'  },
  ],
};

const EIP712_TYPES_V2 = {
  ClaimV2: [
    { name: 'wallet',        type: 'address' },
    { name: 'cartridge',     type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'rewardToken',   type: 'address' },
    { name: 'workHash',      type: 'bytes32' },
    { name: 'attempts',      type: 'uint64'  },
    { name: 'nonce',         type: 'bytes32' },
    { name: 'expiry',        type: 'uint64'  },
  ],
};

const EIP712_DOMAIN_LOCAL = {
  name: 'MinerBoyClaim',
  version: '1',
  chainId: Number(process.env.CHAIN_ID),
  verifyingContract: process.env.ROUTER_ADDRESS as `0x${string}`,
} as const;

// Canonical SHA-256 helper - matches worker exactly
function sha256HexUtf8(s: string): string {
  return '0x' + bytesToHex(sha256(utf8ToBytes(s)));
}

/**
 * Claim processing - handles reward calculations and EIP-712 signing
 */
export class ClaimProcessor {
  private signer: ethers.Wallet;
  private totalSuccessfulClaims: number = 0;
  private usedNonces: Set<string> = new Set();
  
  constructor() {
    this.signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY);
  }
  
  /**
   * Process a claim request
   */
  async processClaim(claimReq: ClaimReq): Promise<ClaimRes | null> {
    // Debug: log what we received
    console.log('[CLAIM RECEIVED]', {
      sessionId: claimReq.sessionId,
      jobId: claimReq.jobId,
      preimage: JSON.stringify(claimReq.preimage),
      hash: claimReq.hash,
      steps: claimReq.steps,
      hr: claimReq.hr
    });
    
    // Validate session
    const session = await SessionStore.getSession(claimReq.sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }
    
    // Validate job
    const job = jobManager.validateJob(claimReq.sessionId, claimReq.jobId, claimReq.preimage.split(':')[0]);
    if (!job) {
      throw new Error('Invalid or expired job');
    }
    
    // Strict preimage sanity checks
    if (!claimReq.preimage.includes(':')) {
      throw new Error('Invalid preimage format');
    }
    const [noncePart, counterPart] = claimReq.preimage.split(':');
    if (!noncePart || counterPart === undefined) {
      throw new Error('Invalid preimage format');
    }
    if (job.nonce !== noncePart) {
      throw new Error('Preimage nonce mismatch');
    }
    
    // Validate hash difficulty using the new system
    if (!hashMeetsDifficulty(claimReq.hash, job.suffix || '')) {
      throw new Error('Hash does not meet difficulty');
    }
    
    // Validate hash matches preimage (using SHA-256, not keccak256)
    if (!this.validatePreimage(claimReq.preimage, claimReq.hash)) {
      throw new Error('Hash does not match preimage');
    }
    
    // Get cartridge config
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) {
      throw new Error('Cartridge not found');
    }
    
    // Calculate reward using tier-based system
    const rewardAmount = this.calculateTierReward(claimReq.hash as `0x${string}`);
    const tierInfo = Rewards.getTierInfo(claimReq.hash as `0x${string}`);
    
    // Create claim struct
    const claimStruct: ClaimStruct = {
      wallet: session.wallet,
      cartridge: session.cartridge.contract,
      tokenId: session.cartridge.tokenId,
      rewardToken: config.REWARD_TOKEN_ADDRESS,
      rewardAmount: rewardAmount.toString(),
      workHash: claimReq.hash,
      attempts: claimReq.steps.toString(),
      nonce: ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`,
      expiry: (Date.now() + 300000).toString(), // 5 minutes from now
    };
    
    // Check nonce uniqueness
    if (this.usedNonces.has(claimStruct.nonce)) {
      throw new Error('Nonce already used');
    }
    
    // Sign the claim with EIP-712
    const signature = await this.signClaim(claimStruct);
    
    // Mark nonce as used and increment successful claims
    this.usedNonces.add(claimStruct.nonce);
    this.totalSuccessfulClaims++;
    
    // Consume the current job to prevent reuse
    jobManager.consumeJob(claimReq.sessionId, claimReq.jobId);
    
    // Create next job from the solution hash
    const nextJob = await jobManager.createNextJob(claimReq.sessionId, claimReq.hash, job);
    
    // Generate claimId and insert pending claim
    const claimId = `clm_${randomUUID()}`;
    insertPendingClaim({
      id: claimId,
      wallet: session.wallet,
      cartridge_id: parseInt(session.cartridge.tokenId),
      hash: claimReq.hash,
      amount_wei: rewardAmount.toString(),
      tx_hash: null,
      status: 'pending',
      created_at: Date.now(),
      pending_expires_at: Date.now() + 15 * 60_000, // 15 min to broadcast
      confirmed_at: null
    });
    
    console.log(`Processed claim for ${session.wallet}: ${ethers.formatEther(rewardAmount)} ABIT (Tier ${tierInfo.tier}: ${tierInfo.name})`);
    if (nextJob) {
      console.log(`Issued next job (epoch ${nextJob.epoch}) with nonce ${nextJob.nonce.slice(0, 10)}...`);
    }
    
    // Return claim data for client to submit
    return {
      success: true,
      claimId,
      claim: claimStruct,
      signature,
      nextJob: serializeJob(nextJob),
      tier: tierInfo.tier,
      tierName: tierInfo.name,
      amountLabel: Rewards.createRewardLabel(claimReq.hash as `0x${string}`, rewardAmount)
    } as ClaimRes & { 
      claimId: string; 
      claim: ClaimStruct; 
      signature: string;
      tier: number;
      tierName: string;
      amountLabel: string;
    };
  }

  /**
   * Process claim using ClaimV2 (no rewardAmount in signature)
   */
  async processClaimV2(claimReq: ClaimReq): Promise<ClaimRes | null> {
    // Validate session
    const session = await SessionStore.getSession(claimReq.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Validate job
    const job = jobManager.validateJob(claimReq.sessionId, claimReq.jobId, claimReq.preimage.split(':')[0]);
    if (!job) {
      throw new Error('Invalid or expired job');
    }

    // Validate hash meets difficulty
    if (!hashMeetsDifficulty(claimReq.hash, job.suffix || '')) {
      throw new Error('Hash does not meet difficulty requirements');
    }

    // Validate hash matches preimage (using SHA-256, not keccak256)
    if (!this.validatePreimage(claimReq.preimage, claimReq.hash)) {
      throw new Error('Hash does not match preimage');
    }

    // Get cartridge config
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) {
      throw new Error('Cartridge not found');
    }

    // Calculate reward using tier-based system
    const rewardAmount = this.calculateTierReward(claimReq.hash as `0x${string}`);
    const tierInfo = Rewards.getTierInfo(claimReq.hash as `0x${string}`);

    // Create claimV2 struct (no rewardAmount)
    const claimStructV2 = {
      wallet: session.wallet,
      cartridge: session.cartridge.contract,
      tokenId: session.cartridge.tokenId,
      rewardToken: config.REWARD_TOKEN_ADDRESS,
      workHash: claimReq.hash,
      attempts: claimReq.steps.toString(),
      nonce: ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`,
      expiry: (Date.now() + 300000).toString(), // 5 minutes from now
    };

    // Check nonce uniqueness
    if (this.usedNonces.has(claimStructV2.nonce)) {
      throw new Error('Nonce already used');
    }

    // Sign the claimV2 with EIP-712
    const signature = await this.signClaimV2(claimStructV2);

    // Mark nonce as used
    this.usedNonces.add(claimStructV2.nonce);

    // Generate next job
    const nextJob = await jobManager.createNextJob(claimReq.sessionId, claimReq.hash, job);

    // Store claim in database
    const claimId = randomUUID();
    await insertPendingClaim({
      id: claimId,
      wallet: session.wallet,
      cartridge_id: parseInt(session.cartridge.tokenId),
      hash: claimReq.hash,
      amount_wei: rewardAmount.toString(),
      tx_hash: null,
      status: 'pending',
      created_at: Date.now(),
      confirmed_at: null,
      pending_expires_at: Date.now() + 15 * 60_000 // 15 min to broadcast
    });

    console.log(`Processed claimV2 for ${session.wallet}: ${ethers.formatEther(rewardAmount)} ABIT (Tier ${tierInfo.tier}: ${tierInfo.name})`);
    if (nextJob) {
      console.log(`Issued next job (epoch ${nextJob.epoch}) with nonce ${nextJob.nonce.slice(0, 10)}...`);
    }

    // Return claimV2 data for client to submit
    return {
      success: true,
      claimId,
      claim: claimStructV2,
      signature,
      nextJob: serializeJob(nextJob),
      tier: tierInfo.tier,
      tierName: tierInfo.name,
      amountLabel: Rewards.createRewardLabel(claimReq.hash as `0x${string}`, rewardAmount)
    } as ClaimRes & { 
      claimId: string; 
      claim: Omit<ClaimStruct, 'rewardAmount'>; 
      signature: string;
      tier: number;
      tierName: string;
      amountLabel: string;
    };
  }
  
  /**
   * Calculate reward using tier-based system
   */
  private calculateTierReward(workHash: `0x${string}`): bigint {
    const tier = Rewards.tierFromHash(workHash);
    const tierName = Rewards.getTierName(tier);
    
    // Linear reward table: 8, 16, 24, ..., 128 ABIT (with 18 decimals)
    const baseAmount = (tier + 1) * 8; // 8, 16, 24, ..., 128
    const reward = BigInt(baseAmount) * BigInt(10 ** 18);
    
    console.log(`Tier reward calculation: tier=${tier} (${tierName}), amount=${baseAmount} ABIT, reward=${ethers.formatEther(reward)} ABIT`);
    
    return reward;
  }
  
  /**
   * Validate that hash ends with required suffix
   */
  private validateHashSuffix(hash: string, suffix: string): boolean {
    const h = hash.toLowerCase().replace(/^0x/, '');
    const s = suffix.toLowerCase().replace(/^0x/, '');
    return h.endsWith(s);
  }
  
  /**
   * Check if hash has trailing zero bits (LSB zeros)
   */
  private hasTrailingZeroBitsHex(hash: string, nBits: number): boolean {
    // check LSB trailing zeros (at the END of the hex string)
    const hex = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();
    // quick lookup # of LSB zero bits in a nibble
    const tzNibble = [4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0]; // index by value 0..15

    let remaining = nBits;
    for (let i = hex.length - 1; i >= 0 && remaining > 0; i--) {
      const v = parseInt(hex[i], 16);
      if (Number.isNaN(v)) return false;

      if (v === 0) {
        remaining -= 4; // full nibble zero
        continue;
      }
      // partial (last) nibble: add its trailing zeros and stop
      remaining -= tzNibble[v];
      break;
    }
    return remaining <= 0;
  }

  /**
   * Validate difficulty (suffix OR bits)
   */
  private validateDifficulty(hash: string, job: any): boolean {
    const hex = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();

    if (job.rule === 'suffix') {
      if (!job.suffix) return false;
      return hex.endsWith(job.suffix.toLowerCase());
    }

    if (job.rule === 'bits') {
      if (typeof job.difficultyBits !== 'number' || job.difficultyBits < 0) return false;
      return this.hasTrailingZeroBitsHex(hash, job.difficultyBits);
    }

    // unknown rule
    return false;
  }
  
  /**
   * Validate that hash matches preimage using SHA-256
   */
  private validatePreimage(preimage: string, expectedHash: string): boolean {
    try {
      const computedHash = sha256HexUtf8(preimage);
      
      // Debug log to see exactly what's happening
      console.log('[CLAIM_VERIFY]', {
        preimage,
        len: preimage.length,
        expectedHash,
        computedHash,
        match: computedHash.toLowerCase() === expectedHash.toLowerCase()
      });
      
      return computedHash.toLowerCase() === expectedHash.toLowerCase();
    } catch (err) {
      console.error('Error validating preimage:', err);
      return false;
    }
  }
  
  /**
   * Sign claim with EIP-712 (V1 - legacy)
   */
  private async signClaim(claim: ClaimStruct): Promise<string> {
    const domain = EIP712_DOMAIN_LOCAL;
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES, claim);
    return signature;
  }

  /**
   * Sign claimV2 with EIP-712 (V2 - no rewardAmount)
   */
  private async signClaimV2(claim: Omit<ClaimStruct, 'rewardAmount'>): Promise<string> {
    const domain = EIP712_DOMAIN_LOCAL;
    
    console.log('[CLAIM_SIGN_V2] Domain verifyingContract:', domain.verifyingContract);
    console.log('[CLAIM_SIGN_V2] Domain chainId:', domain.chainId);
    console.log('[CLAIM_SIGN_V2] Claim rewardToken:', claim.rewardToken);
    console.log('[CLAIM_SIGN_V2] Claim cartridge:', claim.cartridge);
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES_V2, claim);
    
    console.log('[CLAIM_SIGN_V2] Signature:', signature);
    
    return signature;
  }
  
  /**
   * Get claim statistics
   */
  getStats() {
    const currentEpoch = Math.floor(this.totalSuccessfulClaims / config.CLAIMS_PER_EPOCH);
    const currentReward = BigInt(config.INITIAL_REWARD_WEI) >> BigInt(currentEpoch);
    
    return {
      totalSuccessfulClaims: this.totalSuccessfulClaims,
      currentEpoch,
      currentReward: ethers.formatEther(currentReward),
      usedNonces: this.usedNonces.size
    };
  }
  
  /**
   * Reset claims counter (for testing)
   */
  resetClaims() {
    this.totalSuccessfulClaims = 0;
    this.usedNonces.clear();
  }
}

export const claimProcessor = new ClaimProcessor();

// Self-test to verify hashing matches worker
console.log('[SELFTEST]', sha256HexUtf8('test'));
// expect: 0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08

console.log(
  '[SELFTEST2]',
  sha256HexUtf8('0xc9c8830a69c749cdd3c542659dc640361eca2e7815c59fe5eefc0c7a864a113e:177')
);
// expect: 0xce965b584c5831a38762939030cf6486a301dd18b77b48ad1c6b38016a6e7b00
