import { parseAbi } from 'viem';

export const CARTRIDGE_ABI = parseAbi([
  'function mintPrice() view returns (uint256)',
  'function mint(uint256 quantity) payable',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
]);

// fill these with the real deployed addresses
export const CONTRACTS: Record<number, { cartridge: `0x${string}` }> = {
  33133: { cartridge: '0xYOUR_APECHAIN_CONTRACT' },
  33111: { cartridge: '0xYOUR_CURTIS_CONTRACT' }
};

// Legacy exports for compatibility with existing code
export const APEBIT_CARTRIDGE_ABI = CARTRIDGE_ABI;
export const CARTRIDGE_ADDRESS = '0xYOUR_CURTIS_CONTRACT'; // Temporary fallback
export const CURTIS_CHAIN_ID = 33111;
export const EXPLORER_BASE = 'https://curtis.explorer.caldera.xyz';

export const MINING_CLAIM_ROUTER_ABI = parseAbi([
  'function claimRewards(uint256[] memory tokenIds) external',
  'function getClaimableRewards(address user, uint256[] memory tokenIds) view returns (uint256)'
]);

export const contracts = {
  miningClaimRouter: '0xYOUR_MINING_CLAIM_ROUTER_ADDRESS'
};