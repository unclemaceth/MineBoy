import { ethers } from 'ethers';
// Robust interop-safe import
import * as Mining from '../../shared/src/mining';

const getDifficultyForEpoch =
  (Mining as any).getDifficultyForEpoch ??
  (Mining as any).default?.getDifficultyForEpoch;

if (typeof getDifficultyForEpoch !== 'function') {
  throw new Error('shared/mining is missing getDifficultyForEpoch');
}
import { getDifficultyOverride } from './difficulty';
import type { Job } from '../../shared/src/mining.js';
import { config } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { sessionManager } from './sessions.js';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

/**
 * Job management - creates and validates mining jobs
 */
export class JobManager {
  private signer: ethers.Wallet;
  private jobNonces: Map<string, Job> = new Map(); // sessionId -> Job
  private provider: ethers.JsonRpcProvider;
  
  constructor() {
    this.signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY);
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
  }
  
  /**
   * Get current epoch from the MiningClaimRouter contract
   */
  async getCurrentEpoch(): Promise<number> {
    // Use environment override if set, otherwise default to 0 for now
    const epochOverride = process.env.EPOCH_OVERRIDE;
    if (epochOverride !== undefined && epochOverride !== '') {
      console.log(`[EPOCH] Using override: ${epochOverride}`);
      return Number(epochOverride);
    }
    
    try {
      // Simple ABI for reading currentEpoch
      const routerAbi = [
        "function currentEpoch() view returns (uint256)"
      ];
      
      const contract = new ethers.Contract(config.ROUTER_ADDRESS, routerAbi, this.provider);
      const epoch = await contract.currentEpoch();
      return Number(epoch);
    } catch (error) {
      console.warn('Failed to get current epoch from contract, defaulting to 0:', error);
      return 0; // Default to epoch 0 if contract call fails
    }
  }

  /**
   * Issue a job with current difficulty settings
   */
  async issueJob(nonce: string): Promise<Job> {
    const epoch = await this.getCurrentEpoch();
    const diff = getDifficultyForEpoch(epoch);
    const now = Date.now();
    
    // Debug logging
    console.log('[jobs] epoch=%s zeros=%d suffix=%s', epoch, diff.zeros, diff.suffix);
    
    const job: Job = {
      jobId: `job_${now}_${Math.random().toString(36).slice(2)}`,
      algo: 'sha256-suffix',
      charset: 'hex',
      nonce,
      expiresAt: now + diff.ttlMs,
      rule: 'suffix',
      suffix: diff.suffix,
      difficultyBits: diff.zeros,
      epoch,
      ttlMs: diff.ttlMs,
    };
    return job;
  }
  
  /**
   * Create a new job for a session
   */
  async createJob(sessionId: string): Promise<Job | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;
    
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) return null;
    
    // Generate nonce and create job with difficulty
    const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const job = await this.issueJob(nonce);
    
    // Add session-specific fields
    const jobWithSession: Omit<Job, 'sig'> = {
      ...job,
      consumed: false,
      height: 0,
    };
    
    // Sign the job
    const signature = await this.signJob(jobWithSession, session);
    const signedJob: Job = { ...jobWithSession, sig: signature };
    
    // Store job
    this.jobNonces.set(sessionId, signedJob);
    sessionManager.setJob(sessionId, signedJob);
    
    console.log(`Created job ${job.jobId} for session ${sessionId} (epoch ${job.epoch}, rule ${job.rule}, ${job.rule === 'suffix' ? `suffix "${job.suffix}"` : `${job.bits} bits`})`);
    return signedJob;
  }
  
  /**
   * Get current job for session
   */
  getJob(sessionId: string): Job | undefined {
    return this.jobNonces.get(sessionId);
  }
  
  /**
   * Validate job and nonce
   */
  validateJob(sessionId: string, jobId: string, nonce: string): Job | null {
    const job = this.jobNonces.get(sessionId);
    if (!job) return null;
    
    if (job.jobId !== jobId) return null;
    if (job.nonce !== nonce) return null;
    if (Date.now() > job.expiresAt) return null;
    if (job.consumed) return null; // Job already claimed
    
    return job;
  }
  
  /**
   * Mark job as consumed to prevent reuse
   */
  consumeJob(sessionId: string, jobId: string): boolean {
    const job = this.jobNonces.get(sessionId);
    if (!job || job.jobId !== jobId || job.consumed) {
      return false;
    }
    
    job.consumed = true;
    console.log(`Consumed job ${jobId} for session ${sessionId}`);
    return true;
  }

  /**
   * Create next job from previous hash (deterministic chain)
   */
  async createNextJob(sessionId: string, previousHash: string, previousJob: Job): Promise<Job | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;
    
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) return null;
    
    // Derive next nonce from previous hash + session salt
    const saltedInput = `${previousHash}:${sessionId}:${config.SERVER_SALT || 'default_salt'}`;
    const nextNonceBytes = sha256(utf8ToBytes(saltedInput));
    const nextNonce = `0x${bytesToHex(nextNonceBytes)}` as `0x${string}`;
    
    // Create job with current difficulty
    const job = await this.issueJob(nextNonce);
    
    // Add session-specific fields
    const jobWithSession: Omit<Job, 'sig'> = {
      ...job,
      consumed: false,
      height: (previousJob.height || 0) + 1,
    };
    
    // Sign the job
    const signature = await this.signJob(jobWithSession, session);
    const signedJob: Job = { ...jobWithSession, sig: signature };
    
    // Store job
    this.jobNonces.set(sessionId, signedJob);
    sessionManager.setJob(sessionId, signedJob);
    
    console.log(`Created next job ${job.jobId} (height ${jobWithSession.height}) for session ${sessionId} (epoch ${job.epoch}, rule ${job.rule}, ${job.rule === 'suffix' ? `suffix "${job.suffix}"` : `${job.bits} bits`})`);
    return signedJob;
  }

  /**
   * Clear job after use
   */
  clearJob(sessionId: string) {
    this.jobNonces.delete(sessionId);
  }
  
  /**
   * Sign a job with EIP-712
   */
  private async signJob(
    job: Omit<Job, 'sig'>, 
    session: { wallet: string; cartridge: { contract: string; tokenId: string } }
  ): Promise<`0x${string}`> {
    // For now, we'll use a simple signature over the job data
    // In production, you might want to include more context
    const message = JSON.stringify({
      jobId: job.jobId,
      wallet: session.wallet,
      cartridge: session.cartridge.contract,
      tokenId: session.cartridge.tokenId,
      nonce: job.nonce,
      suffix: job.suffix,
      expiresAt: job.expiresAt
    });
    
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));
    
    return signature as `0x${string}`;
  }
  
  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up expired jobs
   */
  cleanupExpiredJobs() {
    const now = Date.now();
    const expiredJobs: string[] = [];
    
    for (const [sessionId, job] of this.jobNonces) {
      if (now > job.expiresAt) {
        expiredJobs.push(sessionId);
      }
    }
    
    for (const sessionId of expiredJobs) {
      this.jobNonces.delete(sessionId);
    }
    
    if (expiredJobs.length > 0) {
      console.log(`Cleaned up ${expiredJobs.length} expired jobs`);
    }
  }
}

export const jobManager = new JobManager();
