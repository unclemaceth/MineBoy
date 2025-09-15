import { ethers } from 'ethers';
import { Job } from '../../shared/src/mining.ts';
import { config } from './config.js';
import { cartridgeRegistry } from './registry.js';
import { sessionManager } from './sessions.js';

/**
 * Job management - creates and validates mining jobs
 */
export class JobManager {
  private signer: ethers.Wallet;
  private jobNonces: Map<string, Job> = new Map(); // sessionId -> Job
  
  constructor() {
    this.signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY);
  }
  
  /**
   * Create a new job for a session
   */
  async createJob(sessionId: string): Promise<Job | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session) return null;
    
    const cartridge = cartridgeRegistry.getCartridge(session.cartridge.contract);
    if (!cartridge) return null;
    
    // Generate job data
    const jobId = this.generateJobId();
    const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`;
    const expiresAt = Date.now() + config.JOB_TTL_MS;
    
    const job: Omit<Job, 'sig'> = {
      jobId,
      algo: cartridge.mining.algo,
      suffix: cartridge.mining.suffix,
      charset: cartridge.mining.charset,
      nonce,
      expiresAt
    };
    
    // Sign the job
    const signature = await this.signJob(job, session);
    const signedJob: Job = { ...job, sig: signature };
    
    // Store job
    this.jobNonces.set(sessionId, signedJob);
    sessionManager.setJob(sessionId, signedJob);
    
    console.log(`Created job ${jobId} for session ${sessionId}`);
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
    
    return job;
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
