/**
 * @file delegate.ts
 * @description Delegate.xyz integration for cold wallet → hot wallet delegation
 * 
 * Allows users to mine with hot wallets while keeping NFTs in cold storage.
 * Backend checks if hot wallet is delegated by vault (which owns the cartridge/NPCs).
 */

import { ethers } from 'ethers';
import { config } from './config.js';

// Delegate Registry V2 address (same on all chains via CREATE2)
const DELEGATE_REGISTRY = '0x00000000000000447e69651d841bD8D104Bed493';

// Rights label for MineBoy-specific delegations (optional but recommended)
const MINEBOY_RIGHTS = ethers.id('mineboy'); // keccak256("mineboy")

// Delegate Registry ABI (minimal)
const DELEGATE_REGISTRY_ABI = [
  // Check if delegate has all permissions for vault
  'function checkDelegateForAll(address delegate, address vault, bytes32 rights) view returns (bool)',
  
  // Check if delegate has permission for specific contract
  'function checkDelegateForContract(address delegate, address vault, address contract, bytes32 rights) view returns (bool)',
  
  // Check if delegate has permission for specific token
  'function checkDelegateForERC721(address delegate, address vault, address contract, uint256 tokenId, bytes32 rights) view returns (bool)',
];

/**
 * Delegate.xyz API types (for auto-detection)
 */
interface DelegationInfo {
  type: 'NONE' | 'ALL' | 'CONTRACT' | 'TOKEN';
  from: string;  // vault (cold wallet)
  to: string;    // delegate (hot wallet)
  contract?: string;
  tokenId?: string;
  rights?: string;
}

/**
 * Delegate verification class
 */
export class DelegateVerifier {
  private provider: ethers.JsonRpcProvider;
  private registry: ethers.Contract;
  private delegationCache: Map<string, { valid: boolean; expires: number }>;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.registry = new ethers.Contract(
      DELEGATE_REGISTRY,
      DELEGATE_REGISTRY_ABI,
      this.provider
    );
    
    // Cache delegation checks for 60 seconds (reduces RPC calls)
    this.delegationCache = new Map();
  }
  
  /**
   * Check if hot wallet is delegated by vault for a specific token
   * 
   * @param hotWallet Address of hot wallet (the one mining)
   * @param vaultWallet Address of vault wallet (owns the NFT)
   * @param contract Address of NFT contract (cartridge)
   * @param tokenId Token ID
   * @param useRights Whether to require "mineboy" rights label
   * @returns true if delegation is valid
   */
  async checkDelegateForToken(
    hotWallet: string,
    vaultWallet: string,
    contract: string,
    tokenId: string,
    useRights: boolean = true
  ): Promise<boolean> {
    // Normalize addresses
    const hot = hotWallet.toLowerCase();
    const vault = vaultWallet.toLowerCase();
    const nftContract = contract.toLowerCase();
    
    // If hot == vault, they're the same wallet (no delegation needed)
    if (hot === vault) {
      return true;
    }
    
    // Check cache
    const cacheKey = `${hot}:${vault}:${nftContract}:${tokenId}:${useRights}`;
    const cached = this.delegationCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.valid;
    }
    
    const rights = useRights ? MINEBOY_RIGHTS : ethers.ZeroHash;
    
    try {
      // Check three delegation scopes (in order of specificity):
      
      // 1. Token-level: Most specific (hot can act for vault for this exact token)
      const tokenLevel = await this.registry.checkDelegateForERC721(
        hot,
        vault,
        nftContract,
        tokenId,
        rights
      );
      
      if (tokenLevel) {
        console.log(`[DELEGATE] ✅ Token-level delegation: ${hot.slice(0, 8)}... → ${vault.slice(0, 8)}... for token ${tokenId}`);
        this.cacheResult(cacheKey, true);
        return true;
      }
      
      // 2. Contract-level: Moderately specific (hot can act for vault for all tokens in this contract)
      const contractLevel = await this.registry.checkDelegateForContract(
        hot,
        vault,
        nftContract,
        rights
      );
      
      if (contractLevel) {
        console.log(`[DELEGATE] ✅ Contract-level delegation: ${hot.slice(0, 8)}... → ${vault.slice(0, 8)}... for ${nftContract.slice(0, 8)}...`);
        this.cacheResult(cacheKey, true);
        return true;
      }
      
      // 3. All-level: Least specific (hot can act for vault for everything)
      const allLevel = await this.registry.checkDelegateForAll(
        hot,
        vault,
        rights
      );
      
      if (allLevel) {
        console.log(`[DELEGATE] ✅ All-level delegation: ${hot.slice(0, 8)}... → ${vault.slice(0, 8)}... (all permissions)`);
        this.cacheResult(cacheKey, true);
        return true;
      }
      
      // No delegation found
      console.log(`[DELEGATE] ❌ No delegation: ${hot.slice(0, 8)}... → ${vault.slice(0, 8)}... for token ${tokenId}`);
      this.cacheResult(cacheKey, false);
      return false;
      
    } catch (error) {
      console.error('[DELEGATE] Error checking delegation:', error);
      return false;
    }
  }
  
  /**
   * Auto-detect vault address for a hot wallet
   * Queries Delegate.xyz API to find incoming delegations
   * 
   * @param hotWallet Address of hot wallet
   * @param chainId Chain ID (33139 for ApeChain)
   * @returns Vault address if found, null otherwise
   */
  async autoDetectVault(
    hotWallet: string,
    chainId: number = 33139
  ): Promise<string | null> {
    try {
      const hot = hotWallet.toLowerCase();
      
      // Query Delegate.xyz API v2 for incoming delegations
      const apiUrl = `https://api.delegate.xyz/registry/v2/${hot}?chainId=${chainId}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`[DELEGATE] API error: ${response.status}`);
        return null;
      }
      
      const delegations: DelegationInfo[] = await response.json();
      
      // Find the first valid delegation (prefer ALL or CONTRACT over TOKEN)
      const allDelegation = delegations.find(d => 
        d.type === 'ALL' && 
        d.to.toLowerCase() === hot
      );
      
      if (allDelegation) {
        console.log(`[DELEGATE] Auto-detected vault (ALL): ${allDelegation.from.slice(0, 8)}... → ${hot.slice(0, 8)}...`);
        return allDelegation.from;
      }
      
      const contractDelegation = delegations.find(d => 
        d.type === 'CONTRACT' && 
        d.to.toLowerCase() === hot
      );
      
      if (contractDelegation) {
        console.log(`[DELEGATE] Auto-detected vault (CONTRACT): ${contractDelegation.from.slice(0, 8)}... → ${hot.slice(0, 8)}...`);
        return contractDelegation.from;
      }
      
      const tokenDelegation = delegations.find(d => 
        d.type === 'TOKEN' && 
        d.to.toLowerCase() === hot
      );
      
      if (tokenDelegation) {
        console.log(`[DELEGATE] Auto-detected vault (TOKEN): ${tokenDelegation.from.slice(0, 8)}... → ${hot.slice(0, 8)}...`);
        return tokenDelegation.from;
      }
      
      console.log(`[DELEGATE] No delegations found for ${hot.slice(0, 8)}...`);
      return null;
      
    } catch (error) {
      console.error('[DELEGATE] Error auto-detecting vault:', error);
      return null;
    }
  }
  
  /**
   * Cache a delegation check result
   */
  private cacheResult(key: string, valid: boolean): void {
    this.delegationCache.set(key, {
      valid,
      expires: Date.now() + 60_000, // 60 seconds
    });
  }
  
  /**
   * Clear expired cache entries (call periodically)
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.delegationCache.entries()) {
      if (value.expires <= now) {
        this.delegationCache.delete(key);
      }
    }
  }
}

export const delegateVerifier = new DelegateVerifier();

// Periodically clear expired cache entries (every 5 minutes)
setInterval(() => {
  delegateVerifier.clearExpiredCache();
}, 300_000);

