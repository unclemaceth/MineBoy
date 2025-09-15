import { ethers } from 'ethers';
import { config } from './config.js';

// ERC-721 ABI (minimal - just ownerOf)
const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)'
];

/**
 * Ownership verification utilities
 */
export class OwnershipVerifier {
  private provider: ethers.JsonRpcProvider;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
  }
  
  /**
   * Verify that wallet owns the specified cartridge token
   */
  async ownsCartridge(
    wallet: string, 
    cartridgeContract: string, 
    tokenId: string
  ): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        cartridgeContract,
        ERC721_ABI,
        this.provider
      );
      
      const owner = await contract.ownerOf(tokenId);
      return owner.toLowerCase() === wallet.toLowerCase();
    } catch (error) {
      console.error('Error checking ownership:', error);
      return false;
    }
  }
  
  /**
   * Get all token IDs owned by a wallet (simple enumeration)
   * Note: This is a basic implementation. For production, consider using
   * indexing services like Alchemy or The Graph for better performance.
   */
  async getOwnedTokenIds(
    wallet: string,
    cartridgeContract: string,
    maxTokenId: number = 10000
  ): Promise<string[]> {
    const ownedTokens: string[] = [];
    
    try {
      const contract = new ethers.Contract(
        cartridgeContract,
        ERC721_ABI,
        this.provider
      );
      
      // Check tokens 1 to maxTokenId (this is inefficient for large collections)
      const promises = [];
      for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
        promises.push(
          contract.ownerOf(tokenId)
            .then((owner: string) => {
              if (owner.toLowerCase() === wallet.toLowerCase()) {
                ownedTokens.push(tokenId.toString());
              }
            })
            .catch(() => {
              // Token doesn't exist or other error, skip
            })
        );
        
        // Process in batches to avoid overwhelming the RPC
        if (promises.length >= 100) {
          await Promise.all(promises);
          promises.length = 0;
        }
      }
      
      // Process remaining promises
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      
    } catch (error) {
      console.error('Error enumerating owned tokens:', error);
    }
    
    return ownedTokens;
  }
}

export const ownershipVerifier = new OwnershipVerifier();
