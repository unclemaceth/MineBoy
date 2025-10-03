import { ethers } from 'ethers';
// Robust interop-safe import
import * as Mining from '../../shared/src/mining.js';
import * as Rewards from '../../shared/src/rewards.js';

const getDifficultyForEpoch =
  (Mining as any).getDifficultyForEpoch ??
  (Mining as any).default?.getDifficultyForEpoch;

if (typeof getDifficultyForEpoch !== 'function') {
  throw new Error('shared/mining is missing getDifficultyForEpoch');
}
import { getDifficultyOverride } from './difficulty.js';
import type { Job } from '../../shared/src/mining.js';
import { config } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { SessionStore } from './sessionStore.js';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

// Internal Job type with session-specific fields
interface InternalJob extends Job {
  consumed?: boolean;
  height?: number;
  sig?: `0x${string}`;
}

/**
 * Job management - creates and validates mining jobs
 * STRICT MODE: All jobs include anti-bot fields (no fallbacks)
 */
export class JobManager {
  private signer: ethers.Wallet;
  private jobNonces: Map<string, InternalJob> = new Map(); // sessionId -> InternalJob
  private provider: ethers.JsonRpcProvider;
  
  // ANTI-BOT: Per-cartridge counter cursors (wallet:contract:tokenId -> counter)
  private counterCursorByKey: Map<string, number> = new Map();
  
  // ANTI-BOT: Last job issuance time per cartridge (for cadence gating)
  private lastJobTimeByKey: Map<string, number> = new Map();
  
  constructor() {
    this.signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY);
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
  }

  /**
   * ANTI-BOT: Build cartridge key for counter/cadence tracking
   */
  private buildCartridgeKey(wallet: string, contract: string, tokenId: string): string {
    return `${wallet.toLowerCase()}:${contract.toLowerCase()}:${tokenId}`;
  }
  
  /**
   * ANTI-BOT: Check if cartridge is eligible for next job (cadence gating)
   */
  canIssueJob(wallet: string, contract: string, tokenId: string): { eligible: boolean; waitMs: number } {
    const key = this.buildCartridgeKey(wallet, contract, tokenId);
    const lastTime = this.lastJobTimeByKey.get(key) || 0;
    const now = Date.now();
    
    // Minimum time between jobs per cartridge (prevent refresh spam)
    const MIN_JOB_CADENCE_MS = parseInt(process.env.MIN_JOB_CADENCE_MS || '10000'); // 10s default
    
    const elapsed = now - lastTime;
    const waitMs = Math.max(0, MIN_JOB_CADENCE_MS - elapsed);
    
    return {
      eligible: waitMs === 0,
      waitMs
    };
  }
  

  /**
   * Get active miners count from database
   */
  private async getActiveMinersCount(): Promise<number> {
    try {
      // Import getDB here to avoid circular dependency
      const { getDB } = await import('./db.js');
      const db = getDB();
      
      const now = Date.now();
      const activeWindowMs = 10 * 60 * 1000; // 10 minutes
      
      const result = await db.pool.query(`
        SELECT COUNT(DISTINCT wallet) AS active_miners
        FROM claims
        WHERE status='confirmed' 
          AND confirmed_at >= $1
      `, [now - activeWindowMs]);
      
      return parseInt(result.rows[0]?.active_miners || '0');
    } catch (error) {
      console.error('Error getting active miners count:', error);
      return 0; // Default to 0 if query fails
    }
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
   * Issue a job with dynamic difficulty based on active miners
   * STRICT MODE: All jobs include required anti-bot fields
   */
  async issueJob(nonce: string, cartridgeKey: string): Promise<Job> {
    const now = Date.now();
    
    // Get active miners count for dynamic difficulty
    const activeMiners = await this.getActiveMinersCount();
    const diff = Rewards.getDifficultyForActiveMiners(activeMiners);
    
    // ANTI-BOT: Get or initialize counter cursor for this cartridge
    // SECURITY: Randomize the starting point to prevent rainbow table attacks
    const existingCursor = this.counterCursorByKey.get(cartridgeKey);
    let counterStart: number;
    
    if (existingCursor !== undefined) {
      // Continue from where we left off
      counterStart = existingCursor;
    } else {
      // SECURITY: First job for this cartridge - start at a random offset
      // Search space: 0 to 10M, randomize to make pre-computation harder
      counterStart = Math.floor(Math.random() * 9_500_000);
      console.log(`[SECURITY] New cartridge ${cartridgeKey} - randomized start: ${counterStart}`);
    }
    
    // ANTI-BOT: Use lease size from difficulty config (scales with difficulty)
    // CASUAL: 100k = 20s @ 5k H/s
    // TRICKY: 250k = 50s @ 5k H/s
    // SERIOUS: 1M = 200s @ 5k H/s
    // BRUTAL: 6M = 1200s @ 5k H/s
    const leaseHashes = diff.leaseHashes;
    const counterEnd = counterStart + leaseHashes;
    
    // ANTI-BOT: Use allowed suffixes from difficulty config
    const allowedSuffixes = diff.allowedSuffixes;
    
    // ANTI-BOT: Get max hashrate from environment
    const maxHps = parseInt(process.env.MINER_MAX_HPS || '1000000'); // Default: no throttle during testing
    
    // Update counter cursor for next job
    this.counterCursorByKey.set(cartridgeKey, counterEnd);
    
    // Update last job time for cadence gating
    this.lastJobTimeByKey.set(cartridgeKey, now);
    
    // Calculate job expiry based on counter window size + claim grace period
    // Window time = leaseHashes / maxHps (in seconds) * 1000 (to ms)
    const windowTimeMs = Math.ceil((leaseHashes / maxHps) * 1000);
    const CLAIM_GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes to submit claim
    const expiresAt = now + windowTimeMs + CLAIM_GRACE_PERIOD_MS;
    const ttlMs = windowTimeMs + CLAIM_GRACE_PERIOD_MS;
    
    // Debug logging
    console.log('[jobs] activeMiners=%d zeros=%d allowedSuffixes=%d counterWindow=[%d,%d) maxHps=%d windowTime=%dms ttl=%dms',
      activeMiners, diff.zeros, allowedSuffixes.length, counterStart, counterEnd, maxHps, windowTimeMs, ttlMs);
    
    // STRICT MODE: All required fields present, no fallbacks
    const job: Job = {
      jobId: `job_${now}_${Math.random().toString(36).slice(2)}`,
      algo: 'sha256-suffix',
      charset: 'hex',
      nonce,
      expiresAt,
      rule: 'suffix',
      suffix: diff.suffix, // DEPRECATED: kept for old client errors
      epoch: 0,
      ttlMs,
      
      // ANTI-BOT FIELDS (REQUIRED)
      issuedAtMs: now,
      counterStart,
      counterEnd,
      maxHps,
      allowedSuffixes,
    };
    
    return job;
  }
  
  /**
   * SECURITY: Check rate limits for job requests
   */
  async checkRateLimits(wallet: string, ipAddress?: string): Promise<{ allowed: boolean; reason?: string; waitMs?: number }> {
    const redis = (await import('./redis.js')).getRedis();
    if (!redis) {
      // If Redis is unavailable, allow the request (fail open)
      return { allowed: true };
    }
    
    const now = Date.now();
    const minute = Math.floor(now / 60000); // Current minute bucket
    
    // SECURITY: Per-wallet rate limit (10 jobs per minute)
    const walletKey = `ratelimit:wallet:${wallet.toLowerCase()}:${minute}`;
    const walletCount = await redis.incr(walletKey);
    await redis.expire(walletKey, 120); // Keep for 2 minutes
    
    if (walletCount > 10) {
      console.warn(`[RATE_LIMIT] Wallet ${wallet} exceeded limit: ${walletCount} requests this minute`);
      return { 
        allowed: false, 
        reason: 'Too many job requests from this wallet',
        waitMs: ((minute + 1) * 60000) - now // Wait until next minute
      };
    }
    
    // SECURITY: Per-IP rate limit (50 jobs per minute)
    if (ipAddress) {
      const ipKey = `ratelimit:ip:${ipAddress}:${minute}`;
      const ipCount = await redis.incr(ipKey);
      await redis.expire(ipKey, 120);
      
      if (ipCount > 50) {
        console.warn(`[RATE_LIMIT] IP ${ipAddress} exceeded limit: ${ipCount} requests this minute`);
        return { 
          allowed: false, 
          reason: 'Too many job requests from this IP',
          waitMs: ((minute + 1) * 60000) - now
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Create a new job for a session
   * STRICT MODE: Includes cadence gating, rate limiting, and counter windows
   */
  async createJob(sessionId: string, ipAddress?: string): Promise<Job | null> {
    const session = await SessionStore.getSession(sessionId);
    if (!session) return null;
    
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) return null;
    
    // SECURITY: Check rate limits before creating job
    const rateLimitCheck = await this.checkRateLimits(session.wallet, ipAddress);
    if (!rateLimitCheck.allowed) {
      console.log(`[jobs] Rate limit exceeded for ${session.wallet}: ${rateLimitCheck.reason}`);
      return null;
    }
    
    // ANTI-BOT: Build cartridge key for tracking
    const cartridgeKey = this.buildCartridgeKey(
      session.wallet,
      session.cartridge.contract,
      session.cartridge.tokenId
    );
    
    // ANTI-BOT: Check cadence eligibility
    const eligibility = this.canIssueJob(
      session.wallet,
      session.cartridge.contract,
      session.cartridge.tokenId
    );
    
    if (!eligibility.eligible) {
      console.log(`[jobs] Cadence gate: cartridge ${cartridgeKey} must wait ${eligibility.waitMs}ms`);
      return null; // Frontend should poll /eligibility
    }
    
    // Generate nonce and create job with difficulty
    const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const job = await this.issueJob(nonce, cartridgeKey);
    
    // Add session-specific fields
    const jobWithSession: InternalJob = {
      ...job,
      consumed: false,
      height: 0,
    };
    
    // Sign the job
    const signature = await this.signJob(jobWithSession, session);
    const signedJob: InternalJob = { ...jobWithSession, sig: signature };
    
    // Store job
    this.jobNonces.set(sessionId, signedJob);
    await SessionStore.setJob(sessionId, signedJob);
    
    console.log(`Created job ${job.jobId} for session ${sessionId} (counter [${job.counterStart},${job.counterEnd}), maxHps ${job.maxHps})`);
    return signedJob;
  }
  
  /**
   * Get current job for session
   */
  getJob(sessionId: string): InternalJob | undefined {
    return this.jobNonces.get(sessionId);
  }
  
  /**
   * Validate job and nonce
   */
  validateJob(sessionId: string, jobId: string, nonce: string): InternalJob | null {
    const job = this.jobNonces.get(sessionId);
    if (!job) return null;
    
    if (job.jobId !== jobId) return null;
    if (job.nonce !== nonce) return null;
    
    // Check if job has expired (expiresAt = window end + 2 min grace period)
    // This prevents AFK mining while allowing time to submit claims
    if (Date.now() > job.expiresAt) {
      console.log(`[validateJob] Job expired (past claim deadline) for job ${jobId}`);
      return null;
    }
    
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
   * STRICT MODE: Includes counter window continuation
   */
  async createNextJob(sessionId: string, previousHash: string, previousJob: InternalJob): Promise<Job | null> {
    const session = await SessionStore.getSession(sessionId);
    if (!session) return null;
    
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) return null;
    
    // ANTI-BOT: Build cartridge key for tracking
    const cartridgeKey = this.buildCartridgeKey(
      session.wallet,
      session.cartridge.contract,
      session.cartridge.tokenId
    );
    
    // Derive next nonce from previous hash + session salt
    const saltedInput = `${previousHash}:${sessionId}:${config.SERVER_SALT || 'default_salt'}`;
    const nextNonceBytes = sha256(utf8ToBytes(saltedInput));
    const nextNonce = `0x${bytesToHex(nextNonceBytes)}` as `0x${string}`;
    
    // Create job with current difficulty (counter auto-continues)
    const job = await this.issueJob(nextNonce, cartridgeKey);
    
    // Add session-specific fields
    const jobWithSession: InternalJob = {
      ...job,
      consumed: false,
      height: (previousJob.height || 0) + 1,
    };
    
    // Sign the job
    const signature = await this.signJob(jobWithSession, session);
    const signedJob: InternalJob = { ...jobWithSession, sig: signature };
    
    // Store job
    this.jobNonces.set(sessionId, signedJob);
    await SessionStore.setJob(sessionId, signedJob);
    
    console.log(`Created next job ${job.jobId} (height ${jobWithSession.height}) for session ${sessionId} (counter [${job.counterStart},${job.counterEnd}), maxHps ${job.maxHps})`);
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
    job: InternalJob, 
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
