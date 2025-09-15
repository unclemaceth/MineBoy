import { ethers } from 'ethers';
import { ClaimReq, ClaimRes, ClaimStruct } from '../../shared/src/mining.ts';
import { config } from './config.js';
import { sessionManager } from './sessions.js';
import { jobManager } from './jobs.js';
import { cartridgeRegistry } from './registry.js';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

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
} as const;

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
    const session = sessionManager.getSession(claimReq.sessionId);
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
    
    // Validate hash suffix
    if (!this.validateHashSuffix(claimReq.hash, job.suffix)) {
      throw new Error('Hash does not end with required suffix');
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
    
    // Calculate reward using halving logic
    const rewardAmount = this.calculateReward();
    
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
      expiry: (Date.now() + 300000).toString() // 5 minutes from now
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
    
    // Clear the job
    jobManager.clearJob(claimReq.sessionId);
    
    console.log(`Processed claim for ${session.wallet}: ${ethers.formatEther(rewardAmount)} ABIT`);
    
    // Return claim data for client to submit
    return {
      ok: true,
      claim: claimStruct,
      signature
    } as ClaimRes & { claim: ClaimStruct; signature: string };
  }
  
  /**
   * Calculate reward using halving logic
   */
  private calculateReward(): bigint {
    const initialReward = BigInt(config.INITIAL_REWARD_WEI);
    const claimsPerEpoch = config.CLAIMS_PER_EPOCH;
    
    // Calculate current epoch
    const epoch = Math.floor(this.totalSuccessfulClaims / claimsPerEpoch);
    
    // Apply halving: reward = initialReward >> epoch
    const reward = initialReward >> BigInt(epoch);
    
    console.log(`Reward calculation: epoch=${epoch}, claims=${this.totalSuccessfulClaims}, reward=${ethers.formatEther(reward)} ABIT`);
    
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
   * Sign claim with EIP-712
   */
  private async signClaim(claim: ClaimStruct): Promise<string> {
    const domain = EIP712_DOMAIN_LOCAL;
    
    const signature = await this.signer.signTypedData(domain, EIP712_TYPES, claim);
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
