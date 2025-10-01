import { ethers } from 'ethers';
import { config } from './config.js';
import { errorResponse } from './utils.js';

// Cartridge contract ABI (just the mint functions)
const CARTRIDGE_ABI = [
  'function mint(address to) external payable',
  'function adminMint(address to, uint256 quantity) external',
  'function balanceOf(address owner) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function maxSupply() external view returns (uint256)',
  'function maxPerWallet() external view returns (uint256)',
  'function mintPrice() external view returns (uint256)'
];

export class MintingService {
  private provider: ethers.Provider;
  private signer: ethers.Wallet;
  private cartridgeContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.signer = new ethers.Wallet(config.SIGNER_PRIVATE_KEY, this.provider);
    
    // Use the first allowed cartridge as the minting contract
    const cartridgeAddress = config.ALLOWED_CARTRIDGES[0];
    this.cartridgeContract = new ethers.Contract(cartridgeAddress, CARTRIDGE_ABI, this.signer);
  }

  /**
   * Check if a wallet can mint (based on maxPerWallet limit)
   */
  async canMint(walletAddress: string): Promise<{ canMint: boolean; reason?: string }> {
    try {
      const [balance, maxPerWallet] = await Promise.all([
        this.cartridgeContract.balanceOf(walletAddress),
        this.cartridgeContract.maxPerWallet()
      ]);
      
      const ownedCount = Number(balance);
      const maxAllowed = Number(maxPerWallet);
      
      if (ownedCount >= maxAllowed) {
        return { canMint: false, reason: `Wallet already owns ${ownedCount} cartridge(s) (max: ${maxAllowed})` };
      }
      
      return { canMint: true };
    } catch (error) {
      console.error('Error checking mint eligibility:', error);
      return { canMint: false, reason: 'Failed to check ownership' };
    }
  }

  /**
   * Check supply limits
   */
  async getSupplyInfo(): Promise<{ totalSupply: number; maxSupply: number; remaining: number }> {
    try {
      const [totalSupply, maxSupply] = await Promise.all([
        this.cartridgeContract.totalSupply(),
        this.cartridgeContract.maxSupply()
      ]);
      
      const total = Number(totalSupply);
      const max = Number(maxSupply);
      
      return {
        totalSupply: total,
        maxSupply: max,
        remaining: Math.max(0, max - total)
      };
    } catch (error) {
      console.error('Error getting supply info:', error);
      return { totalSupply: 0, maxSupply: 0, remaining: 0 };
    }
  }

  /**
   * Mint a cartridge to a wallet
   */
  async mintCartridge(walletAddress: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Check if wallet can mint
      const eligibility = await this.canMint(walletAddress);
      if (!eligibility.canMint) {
        return { success: false, error: eligibility.reason };
      }

      // Check supply
      const supplyInfo = await this.getSupplyInfo();
      if (supplyInfo.remaining <= 0) {
        return { success: false, error: 'No cartridges remaining' };
      }

      // Mint the cartridge using adminMint (free for admins)
      console.log(`Minting cartridge to ${walletAddress}...`);
      const tx = await this.cartridgeContract.adminMint(walletAddress, 1);
      console.log(`Mint transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Mint transaction confirmed: ${receipt.hash}`);
      
      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      console.error('Error minting cartridge:', error);
      return { 
        success: false, 
        error: error.message || 'Minting failed' 
      };
    }
  }
}

export const mintingService = new MintingService();
