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
    // ANTI-BOT: Include new required fields
    allowedSuffixes: job.allowedSuffixes,
    counterStart: job.counterStart,
    counterEnd: job.counterEnd,
    maxHps: job.maxHps,
    issuedAtMs: job.issuedAtMs,
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

const EIP712_TYPES_V3 = {
  ClaimV3: [
    { name: 'cartridge',     type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'wallet',        type: 'address' },
    { name: 'nonce',         type: 'bytes32' },
    { name: 'tier',          type: 'uint256' },
    { name: 'tries',         type: 'uint256' },
    { name: 'elapsedMs',     type: 'uint256' },
    { name: 'hash',          type: 'bytes32' },
    { name: 'expiry',        type: 'uint256' },
  ],
};

// V3.1: Adds caller field for delegate support
const EIP712_TYPES_V3_1 = {
  ClaimV3: [
    { name: 'cartridge',     type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'wallet',        type: 'address' },  // vault/owner
    { name: 'caller',        type: 'address' },  // hot wallet (NEW)
    { name: 'nonce',         type: 'bytes32' },
    { name: 'tier',          type: 'uint256' },
    { name: 'tries',         type: 'uint256' },
    { name: 'elapsedMs',     type: 'uint256' },
    { name: 'hash',          type: 'bytes32' },
    { name: 'expiry',        type: 'uint256' },
  ],
};

const EIP712_DOMAIN_LOCAL = {
  name: 'MinerBoyClaim',
  version: '1',
  chainId: Number(process.env.CHAIN_ID),
  verifyingContract: process.env.ROUTER_ADDRESS as `0x${string}`,
} as const;

const EIP712_DOMAIN_V3 = {
  name: 'MiningClaimRouter',
  version: '3',
  chainId: Number(process.env.CHAIN_ID),
  verifyingContract: process.env.ROUTER_ADDRESS as `0x${string}`,
} as const;

// V3.1: Uses ROUTER_V3_1_ADDRESS and version "3.1"
const EIP712_DOMAIN_V3_1 = {
  name: 'MiningClaimRouter',
  version: '3.1',
  chainId: Number(process.env.CHAIN_ID),
  verifyingContract: (config.ROUTER_V3_1_ADDRESS || config.ROUTER_ADDRESS) as `0x${string}`,
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
   * Process a claim request (DEPRECATED - use processClaimV2)
   * STRICT MODE: Enforces physics-based validation
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
    
    // ANTI-BOT: STRICT validation - job MUST have all required fields
    if (!job.issuedAtMs || job.counterStart === undefined || job.counterEnd === undefined || !job.maxHps || !job.allowedSuffixes) {
      throw new Error('Job missing anti-bot fields - client must upgrade');
    }
    
    // SECURITY: Strict preimage sanity checks - must be nonce:counter:wallet:tokenId
    const parts = claimReq.preimage.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid preimage format - expected nonce:counter:wallet:tokenId');
    }
    const [noncePart, counterPart, walletPart, tokenIdPart] = parts;
    if (!noncePart || counterPart === undefined || !walletPart || !tokenIdPart) {
      throw new Error('Invalid preimage format - missing parts');
    }
    if (job.nonce !== noncePart) {
      throw new Error('Preimage nonce mismatch');
    }
    
    // SECURITY: Verify wallet matches session wallet
    if (walletPart.toLowerCase() !== session.wallet.toLowerCase()) {
      throw new Error('Preimage wallet mismatch - work stealing attempt detected');
    }
    
    // SECURITY: Verify tokenId matches session cartridge
    if (tokenIdPart !== session.cartridge.tokenId) {
      throw new Error('Preimage tokenId mismatch - cartridge spoofing detected');
    }
    
    // ANTI-BOT: Validate counter
    const counter = parseInt(counterPart, 10);
    if (isNaN(counter) || counter < 0) {
      throw new Error('Invalid counter in preimage');
    }
    if (counter < job.counterStart || counter >= job.counterEnd) {
      throw new Error(`Counter ${counter} out of assigned range [${job.counterStart}, ${job.counterEnd})`);
    }
    
    // ANTI-BOT: Import hashMeetsRule for strict suffix checking
    const hashMeetsRule = (Mining as any).hashMeetsRule ?? (Mining as any).default?.hashMeetsRule;
    if (typeof hashMeetsRule !== 'function') {
      throw new Error('shared/mining is missing hashMeetsRule');
    }
    
    // Validate hash difficulty using allowedSuffixes (STRICT)
    try {
      if (!hashMeetsRule(claimReq.hash, job)) {
        throw new Error('Hash does not match any allowed suffix');
      }
    } catch (error) {
      throw new Error(`Hash validation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    
    // ANTI-BOT: Physics check
    const now = Date.now();
    const elapsedMs = now - job.issuedAtMs;
    const tries = counter - job.counterStart + 1;
    
    const minMsForTries = (Mining as any).minMsForTries ?? (Mining as any).default?.minMsForTries;
    if (typeof minMsForTries !== 'function') {
      throw new Error('shared/mining is missing minMsForTries');
    }
    
    // SECURITY: Tightened physics validation (85% slack = max 1.18x speedup allowed)
    const SLACK_TOLERANCE = 0.85; // Increased from 0.70 to make GPU mining harder
    const minRequired = minMsForTries(tries, job.maxHps, SLACK_TOLERANCE);
    
    // SECURITY: Reject claims that are too fast (possible GPU mining)
    if (elapsedMs < minRequired) {
      console.warn(`[ANTI-BOT] REJECTED too fast: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms)`);
      throw new Error(
        `Claim too fast: ${tries} hashes in ${elapsedMs}ms, ` +
        `minimum ${minRequired}ms required at ${job.maxHps} H/s (85% slack)`
      );
    }
    
    // SECURITY: Reject extremely slow claims ONLY if they searched through most of the window
    // This prevents cherry-picking full windows, but allows users to wait before claiming lucky finds
    const windowSize = job.counterEnd - job.counterStart;
    const percentSearched = tries / windowSize;
    
    // Only enforce max-time if user searched >50% of window (prevents cherry-picking entire windows)
    if (percentSearched > 0.5) {
      const maxAllowed = minMsForTries(tries, job.maxHps, 0.20); // Allow 5x slower (1/0.2 = 5)
      if (elapsedMs > maxAllowed) {
        console.warn(`[ANTI-BOT] REJECTED extremely slow: ${tries} hashes (${(percentSearched * 100).toFixed(1)}% of window) in ${elapsedMs}ms (max: ${maxAllowed}ms)`);
        throw new Error(
          `Work took too long to complete: ${tries} hashes in ${elapsedMs}ms, ` +
          `maximum ${maxAllowed}ms expected (work may be stale)`
        );
      }
    }
    
    // Calculate timing ratio for statistical tracking
    const expectedMs = minMsForTries(tries, job.maxHps, 1.0); // Perfect theoretical time
    const timingRatio = elapsedMs / expectedMs;
    
    console.log(`[ANTI-BOT] Physics check passed: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms, ratio: ${timingRatio.toFixed(2)})`);
    
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
      expiry: (Math.floor(Date.now() / 1000) + 300).toString(), // 5 minutes from now (in seconds)
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
   * STRICT MODE: Enforces physics-based validation
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

    // ANTI-BOT: STRICT validation - job MUST have all required fields
    if (!job.issuedAtMs || job.counterStart === undefined || job.counterEnd === undefined || !job.maxHps || !job.allowedSuffixes) {
      throw new Error('Job missing anti-bot fields - client must upgrade');
    }
    
    // SECURITY: Strict preimage sanity checks - must be nonce:counter:wallet:tokenId
    const parts = claimReq.preimage.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid preimage format - expected nonce:counter:wallet:tokenId');
    }
    const [noncePart, counterPart, walletPart, tokenIdPart] = parts;
    if (!noncePart || counterPart === undefined || !walletPart || !tokenIdPart) {
      throw new Error('Invalid preimage format - missing parts');
    }
    if (job.nonce !== noncePart) {
      throw new Error('Preimage nonce mismatch');
    }
    
    // SECURITY: Verify wallet matches session wallet
    if (walletPart.toLowerCase() !== session.wallet.toLowerCase()) {
      throw new Error('Preimage wallet mismatch - work stealing attempt detected');
    }
    
    // SECURITY: Verify tokenId matches session cartridge
    if (tokenIdPart !== session.cartridge.tokenId) {
      throw new Error('Preimage tokenId mismatch - cartridge spoofing detected');
    }
    
    // ANTI-BOT: Validate counter
    const counter = parseInt(counterPart, 10);
    if (isNaN(counter) || counter < 0) {
      throw new Error('Invalid counter in preimage');
    }
    if (counter < job.counterStart || counter >= job.counterEnd) {
      throw new Error(`Counter ${counter} out of assigned range [${job.counterStart}, ${job.counterEnd})`);
    }

    // ANTI-BOT: Import hashMeetsRule for strict suffix checking
    const hashMeetsRule = (Mining as any).hashMeetsRule ?? (Mining as any).default?.hashMeetsRule;
    if (typeof hashMeetsRule !== 'function') {
      throw new Error('shared/mining is missing hashMeetsRule');
    }

    // ANTI-BOT: Validate hash using allowedSuffixes (STRICT - no fallback)
    try {
      if (!hashMeetsRule(claimReq.hash, job)) {
        throw new Error('Hash does not match any allowed suffix');
      }
    } catch (error) {
      throw new Error(`Hash validation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    // ANTI-BOT: Physics check - time plausibility
    const now = Date.now();
    const elapsedMs = now - job.issuedAtMs;
    
    // Calculate number of hashes attempted (counter - counterStart)
    const tries = counter - job.counterStart + 1; // +1 because counter is inclusive
    
    // Import minMsForTries
    const minMsForTries = (Mining as any).minMsForTries ?? (Mining as any).default?.minMsForTries;
    if (typeof minMsForTries !== 'function') {
      throw new Error('shared/mining is missing minMsForTries');
    }
    
    // SECURITY: Tightened physics validation (85% slack = max 1.18x speedup allowed)
    const SLACK_TOLERANCE = 0.85; // Increased from 0.70 to make GPU mining harder
    const minRequired = minMsForTries(tries, job.maxHps, SLACK_TOLERANCE);
    
    // SECURITY: Reject claims that are too fast (possible GPU mining)
    if (elapsedMs < minRequired) {
      console.warn(`[ANTI-BOT] REJECTED too fast: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms)`);
      throw new Error(
        `Claim too fast: ${tries} hashes in ${elapsedMs}ms, ` +
        `minimum ${minRequired}ms required at ${job.maxHps} H/s (85% slack)`
      );
    }
    
    // SECURITY: Reject extremely slow claims ONLY if they searched through most of the window
    // This prevents cherry-picking full windows, but allows users to wait before claiming lucky finds
    const windowSize = job.counterEnd - job.counterStart;
    const percentSearched = tries / windowSize;
    
    // Only enforce max-time if user searched >50% of window (prevents cherry-picking entire windows)
    if (percentSearched > 0.5) {
      const maxAllowed = minMsForTries(tries, job.maxHps, 0.20); // Allow 5x slower (1/0.2 = 5)
      if (elapsedMs > maxAllowed) {
        console.warn(`[ANTI-BOT] REJECTED extremely slow: ${tries} hashes (${(percentSearched * 100).toFixed(1)}% of window) in ${elapsedMs}ms (max: ${maxAllowed}ms)`);
        throw new Error(
          `Work took too long to complete: ${tries} hashes in ${elapsedMs}ms, ` +
          `maximum ${maxAllowed}ms expected (work may be stale)`
        );
      }
    }
    
    // Calculate timing ratio for statistical tracking
    const expectedMs = minMsForTries(tries, job.maxHps, 1.0); // Perfect theoretical time
    const timingRatio = elapsedMs / expectedMs;
    
    console.log(`[ANTI-BOT] Physics check passed: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms, ratio: ${timingRatio.toFixed(2)})`);

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
      expiry: (Math.floor(Date.now() / 1000) + 300).toString(), // 5 minutes from now (in seconds)
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
   * Process claim with V3 router (multipliers + dynamic fees)
   */
  async processClaimV3(claimReq: ClaimReq): Promise<ClaimRes | null> {
    // Import multiplier module
    const { calculateMultiplier } = await import('./multipliers.js');
    
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

    // ANTI-BOT: STRICT validation - job MUST have all required fields
    if (!job.issuedAtMs || job.counterStart === undefined || job.counterEnd === undefined || !job.maxHps || !job.allowedSuffixes) {
      throw new Error('Job missing anti-bot fields - client must upgrade');
    }
    
    // SECURITY: Strict preimage sanity checks - must be nonce:counter:wallet:tokenId
    const parts = claimReq.preimage.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid preimage format - expected nonce:counter:wallet:tokenId');
    }
    const [noncePart, counterPart, walletPart, tokenIdPart] = parts;
    if (!noncePart || counterPart === undefined || !walletPart || !tokenIdPart) {
      throw new Error('Invalid preimage format - missing parts');
    }
    if (job.nonce !== noncePart) {
      throw new Error('Preimage nonce mismatch');
    }
    
    // SECURITY: Verify wallet matches session wallet
    if (walletPart.toLowerCase() !== session.wallet.toLowerCase()) {
      throw new Error('Preimage wallet mismatch - work stealing attempt detected');
    }
    
    // SECURITY: Verify tokenId matches session cartridge
    if (tokenIdPart !== session.cartridge.tokenId) {
      throw new Error('Preimage tokenId mismatch - cartridge spoofing detected');
    }
    
    // ANTI-BOT: Validate counter
    const counter = parseInt(counterPart, 10);
    if (isNaN(counter) || counter < 0) {
      throw new Error('Invalid counter in preimage');
    }
    if (counter < job.counterStart || counter >= job.counterEnd) {
      throw new Error(`Counter ${counter} out of assigned range [${job.counterStart}, ${job.counterEnd})`);
    }

    // ANTI-BOT: Import hashMeetsRule for strict suffix checking
    const hashMeetsRule = (Mining as any).hashMeetsRule ?? (Mining as any).default?.hashMeetsRule;
    if (typeof hashMeetsRule !== 'function') {
      throw new Error('shared/mining is missing hashMeetsRule');
    }

    // ANTI-BOT: Validate hash using allowedSuffixes (STRICT - no fallback)
    try {
      if (!hashMeetsRule(claimReq.hash, job)) {
        throw new Error('Hash does not match any allowed suffix');
      }
    } catch (error) {
      throw new Error(`Hash validation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    // ANTI-BOT: Physics check - time plausibility
    const now = Date.now();
    const elapsedMs = now - job.issuedAtMs;
    
    // Calculate number of hashes attempted (counter - counterStart)
    const tries = counter - job.counterStart + 1; // +1 because counter is inclusive
    
    // Import minMsForTries
    const minMsForTries = (Mining as any).minMsForTries ?? (Mining as any).default?.minMsForTries;
    if (typeof minMsForTries !== 'function') {
      throw new Error('shared/mining is missing minMsForTries');
    }
    
    // SECURITY: Tightened physics validation (85% slack = max 1.18x speedup allowed)
    const SLACK_TOLERANCE = 0.85;
    const minRequired = minMsForTries(tries, job.maxHps, SLACK_TOLERANCE);
    
    // SECURITY: Reject claims that are too fast (possible GPU mining)
    if (elapsedMs < minRequired) {
      console.warn(`[ANTI-BOT] REJECTED too fast: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms)`);
      throw new Error(
        `Claim too fast: ${tries} hashes in ${elapsedMs}ms, ` +
        `minimum ${minRequired}ms required at ${job.maxHps} H/s (85% slack)`
      );
    }
    
    // SECURITY: Reject extremely slow claims ONLY if they searched through most of the window
    const windowSize = job.counterEnd - job.counterStart;
    const percentSearched = tries / windowSize;
    
    if (percentSearched > 0.5) {
      const maxAllowed = minMsForTries(tries, job.maxHps, 0.20);
      if (elapsedMs > maxAllowed) {
        console.warn(`[ANTI-BOT] REJECTED extremely slow: ${tries} hashes (${(percentSearched * 100).toFixed(1)}% of window) in ${elapsedMs}ms (max: ${maxAllowed}ms)`);
        throw new Error(
          `Work took too long to complete: ${tries} hashes in ${elapsedMs}ms, ` +
          `maximum ${maxAllowed}ms expected (work may be stale)`
        );
      }
    }
    
    // Calculate timing ratio for statistical tracking
    const expectedMs = minMsForTries(tries, job.maxHps, 1.0);
    const timingRatio = elapsedMs / expectedMs;
    
    console.log(`[ANTI-BOT] Physics check passed: ${tries} hashes in ${elapsedMs}ms (min: ${minRequired}ms, ratio: ${timingRatio.toFixed(2)})`);

    // Validate hash matches preimage
    if (!this.validatePreimage(claimReq.preimage, claimReq.hash)) {
      throw new Error('Hash does not match preimage');
    }

    // Calculate base reward using tier-based system
    const baseReward = this.calculateTierReward(claimReq.hash as `0x${string}`);
    const tierInfo = Rewards.getTierInfo(claimReq.hash as `0x${string}`);

    // Calculate multiplier based on owner's NFT holdings (vault if delegating)
    const ownerAddress = (session as any).owner || session.wallet;
    console.log(`[V3_CLAIM] Calculating multiplier for ${ownerAddress}...`);
    const multiplierResult = await calculateMultiplier(ownerAddress);
    
    // Apply multiplier to base reward
    const { applyMultiplier } = await import('./multipliers.js');
    const finalReward = applyMultiplier(baseReward, multiplierResult.multiplierBps);

    console.log(`[V3_CLAIM] Base reward: ${ethers.formatEther(baseReward)} ABIT`);
    console.log(`[V3_CLAIM] Multiplier: ${multiplierResult.multiplier}x (${multiplierResult.multiplierBps} bps)`);
    console.log(`[V3_CLAIM] Final reward: ${ethers.formatEther(finalReward)} ABIT`);

    // Create claimV3 struct (feature-flagged for V3.1 delegate support)
    const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const expiry = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now (in seconds)
    
    const claimStructV3 = config.DELEGATE_PHASE1_ENABLED ? {
      // V3.1: Includes caller field
      cartridge: session.cartridge.contract,
      tokenId: session.cartridge.tokenId,
      wallet: (session as any).owner || session.wallet,  // Vault if delegating
      caller: (session as any).caller || session.wallet, // Hot wallet
      nonce,
      tier: tierInfo.tier,
      tries: tries,
      elapsedMs: elapsedMs,
      hash: claimReq.hash,
      expiry,
    } : {
      // V3: Original structure
      cartridge: session.cartridge.contract,
      tokenId: session.cartridge.tokenId,
      wallet: session.wallet,
      nonce,
      tier: tierInfo.tier,
      tries: tries,
      elapsedMs: elapsedMs,
      hash: claimReq.hash,
      expiry,
    };

    // Check nonce uniqueness
    if (this.usedNonces.has(nonce)) {
      throw new Error('Nonce already used');
    }

    // Sign the claimV3 with EIP-712 (V3 or V3.1)
    const signature = config.DELEGATE_PHASE1_ENABLED 
      ? await this.signClaimV3_1(claimStructV3 as any)
      : await this.signClaimV3(claimStructV3);

    // Mark nonce as used
    this.usedNonces.add(claimStructV3.nonce);

    // Generate next job
    const nextJob = await jobManager.createNextJob(claimReq.sessionId, claimReq.hash, job);

    // Store claim in database
    const claimId = randomUUID();
    await insertPendingClaim({
      id: claimId,
      wallet: session.wallet,
      cartridge_id: parseInt(session.cartridge.tokenId),
      hash: claimReq.hash,
      amount_wei: finalReward.toString(), // Store final reward (with multiplier)
      tx_hash: null,
      status: 'pending',
      created_at: Date.now(),
      confirmed_at: null,
      pending_expires_at: Date.now() + 15 * 60_000
    });

    console.log(`Processed claimV3 for ${session.wallet}: ${ethers.formatEther(finalReward)} ABIT (Tier ${tierInfo.tier}: ${tierInfo.name}, ${multiplierResult.multiplier}x multiplier)`);
    if (nextJob) {
      console.log(`Issued next job (epoch ${nextJob.epoch}) with nonce ${nextJob.nonce.slice(0, 10)}...`);
    }

    // Return claimV3 data for client to submit
    return {
      success: true,
      claimId,
      claim: claimStructV3,
      signature,
      nextJob: serializeJob(nextJob),
      tier: tierInfo.tier,
      tierName: tierInfo.name,
      amountLabel: Rewards.createRewardLabel(claimReq.hash as `0x${string}`, finalReward),
      multiplier: multiplierResult, // Include multiplier info for frontend display
    } as ClaimRes & { 
      claimId: string; 
      claim: any;
      signature: string;
      tier: number;
      tierName: string;
      amountLabel: string;
      multiplier: any;
    };
  }

  /**
   * Calculate reward using tier-based system
   * Tier 0 (0x0... Hashalicious) = 128 ABIT (best)
   * Tier 15 (0xf... Trash Hash) = 8 ABIT (worst)
   */
  private calculateTierReward(workHash: `0x${string}`): bigint {
    const tier = Rewards.tierFromHash(workHash);
    const tierName = Rewards.getTierName(tier);
    
    // Inverted linear reward table: Tier 0 = 128, Tier 1 = 120, ..., Tier 15 = 8
    const baseAmount = (16 - tier) * 8; // Tier 0 = 128, Tier 15 = 8
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
    console.log('[CLAIM_SIGN_V2] Signer address:', this.signer.address);
    console.log('[CLAIM_SIGN_V2] Claim wallet:', claim.wallet);
    console.log('[CLAIM_SIGN_V2] Claim cartridge:', claim.cartridge);
    console.log('[CLAIM_SIGN_V2] Claim tokenId:', claim.tokenId);
    console.log('[CLAIM_SIGN_V2] Claim rewardToken:', claim.rewardToken);
    console.log('[CLAIM_SIGN_V2] Claim workHash:', claim.workHash);
    console.log('[CLAIM_SIGN_V2] Claim nonce:', claim.nonce);
    console.log('[CLAIM_SIGN_V2] Claim expiry:', claim.expiry);
    console.log('[CLAIM_SIGN_V2] Current timestamp:', Math.floor(Date.now() / 1000));
    console.log('[CLAIM_SIGN_V2] Expiry - now:', parseInt(claim.expiry) - Math.floor(Date.now() / 1000), 'seconds');
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES_V2, claim);
    
    console.log('[CLAIM_SIGN_V2] Signature:', signature);
    
    return signature;
  }

  /**
   * Sign claimV3 with EIP-712 (V3 - with multipliers and dynamic fees)
   */
  private async signClaimV3(claim: {
    cartridge: string;
    tokenId: string;
    wallet: string;
    nonce: string;
    tier: number;
    tries: number;
    elapsedMs: number;
    hash: string;
    expiry: number;
  }): Promise<string> {
    const domain = EIP712_DOMAIN_V3;
    
    console.log('[CLAIM_SIGN_V3] Domain verifyingContract:', domain.verifyingContract);
    console.log('[CLAIM_SIGN_V3] Domain chainId:', domain.chainId);
    console.log('[CLAIM_SIGN_V3] Signer address:', this.signer.address);
    console.log('[CLAIM_SIGN_V3] Claim cartridge:', claim.cartridge);
    console.log('[CLAIM_SIGN_V3] Claim tokenId:', claim.tokenId);
    console.log('[CLAIM_SIGN_V3] Claim wallet:', claim.wallet);
    console.log('[CLAIM_SIGN_V3] Claim tier:', claim.tier);
    console.log('[CLAIM_SIGN_V3] Claim tries:', claim.tries);
    console.log('[CLAIM_SIGN_V3] Claim elapsedMs:', claim.elapsedMs);
    console.log('[CLAIM_SIGN_V3] Claim hash:', claim.hash);
    console.log('[CLAIM_SIGN_V3] Claim expiry:', claim.expiry);
    console.log('[CLAIM_SIGN_V3] Current timestamp:', Math.floor(Date.now() / 1000));
    console.log('[CLAIM_SIGN_V3] Expiry - now:', claim.expiry - Math.floor(Date.now() / 1000), 'seconds');
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES_V3, claim);
    
    console.log('[CLAIM_SIGN_V3] Signature:', signature);
    
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
   * Sign claimV3.1 with EIP-712 (V3.1 - adds caller field for delegate support)
   */
  private async signClaimV3_1(claim: {
    cartridge: string;
    tokenId: string;
    wallet: string;   // vault/owner
    caller: string;   // hot wallet
    nonce: string;
    tier: number;
    tries: number;
    elapsedMs: number;
    hash: string;
    expiry: number;
  }): Promise<string> {
    const domain = EIP712_DOMAIN_V3_1;
    
    console.log('[CLAIM_SIGN_V3.1] Domain verifyingContract:', domain.verifyingContract);
    console.log('[CLAIM_SIGN_V3.1] Domain version:', domain.version);
    console.log('[CLAIM_SIGN_V3.1] Domain chainId:', domain.chainId);
    console.log('[CLAIM_SIGN_V3.1] Signer address:', this.signer.address);
    console.log('[CLAIM_SIGN_V3.1] Claim cartridge:', claim.cartridge);
    console.log('[CLAIM_SIGN_V3.1] Claim tokenId:', claim.tokenId);
    console.log('[CLAIM_SIGN_V3.1] Claim wallet (owner):', claim.wallet);
    console.log('[CLAIM_SIGN_V3.1] Claim caller (hot):', claim.caller);
    console.log('[CLAIM_SIGN_V3.1] Claim tier:', claim.tier);
    console.log('[CLAIM_SIGN_V3.1] Claim tries:', claim.tries);
    console.log('[CLAIM_SIGN_V3.1] Claim elapsedMs:', claim.elapsedMs);
    console.log('[CLAIM_SIGN_V3.1] Claim hash:', claim.hash);
    console.log('[CLAIM_SIGN_V3.1] Claim expiry:', claim.expiry);
    console.log('[CLAIM_SIGN_V3.1] Current timestamp:', Math.floor(Date.now() / 1000));
    console.log('[CLAIM_SIGN_V3.1] Expiry - now:', claim.expiry - Math.floor(Date.now() / 1000), 'seconds');
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES_V3_1, claim);
    
    console.log('[CLAIM_SIGN_V3.1] Signature:', signature);
    
    return signature;
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
