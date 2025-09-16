import { CartridgeConfig } from '../../shared/src/mining.ts';
import { config } from './config.js';

/**
 * Cartridge registry - defines available mining cartridges
 */
export class CartridgeRegistry {
  private cartridges: Map<string, CartridgeConfig> = new Map();
  
  constructor() {
    this.initializeCartridges();
  }
  
  private initializeCartridges() {
    // ApeBit cartridge - first cartridge
    if (config.ALLOWED_CARTRIDGES.length > 0) {
      const apeBitCartridge: CartridgeConfig = {
        slug: 'ape-bit-erc20',
        name: 'ApeBit Cartridge',
        chainId: config.CHAIN_ID,
        standard: 'erc721',
        contract: config.ALLOWED_CARTRIDGES[0],
        image: 'ipfs://QmYourApeBitCartridgeImage', // TODO: Replace with real IPFS hash
        mining: {
          algo: 'sha256-suffix',
          charset: 'hex',
          difficulty: 0
        },
        claim: {
          type: 'erc20',
          token: config.REWARD_TOKEN_ADDRESS,
          router: config.ROUTER_ADDRESS,
          chainId: config.CHAIN_ID
        }
      };
      
      this.cartridges.set(apeBitCartridge.contract.toLowerCase(), apeBitCartridge);
    }
  }
  
  /**
   * Get all available cartridges
   */
  getAllCartridges(): CartridgeConfig[] {
    return Array.from(this.cartridges.values());
  }
  
  /**
   * Get cartridge by contract address
   */
  getCartridge(contract: string): CartridgeConfig | undefined {
    return this.cartridges.get(contract.toLowerCase());
  }
  
  /**
   * Check if cartridge is allowed
   */
  isAllowed(contract: string): boolean {
    return this.cartridges.has(contract.toLowerCase());
  }
  
  /**
   * Add a new cartridge (for admin use)
   */
  addCartridge(cartridge: CartridgeConfig) {
    this.cartridges.set(cartridge.contract.toLowerCase(), cartridge);
  }
  
  /**
   * Remove a cartridge (for admin use)
   */
  removeCartridge(contract: string) {
    this.cartridges.delete(contract.toLowerCase());
  }
}

export const cartridgeRegistry = new CartridgeRegistry();
