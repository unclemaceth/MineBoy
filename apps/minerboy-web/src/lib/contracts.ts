// Contract configuration for ApeBit MinerBoy
export const CURTIS_CHAIN_ID = 33111;

// Cartridge contract address (from backend logs)
export const CARTRIDGE_ADDRESS = "0xb05fa76709b6bd18c63782e9044ff81430f6769c";

// Explorer base URL (set via environment variable)
export const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE || null;

// ERC-721 Cartridge ABI (minimal for minting)
export const CARTRIDGE_ABI = [
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  
  // Functions
  "function mint(uint256 count) external payable returns (uint256)",
  "function mintBatch(uint256 count) external payable",
  "function mint() external payable returns (uint256)",
  "function mintPrice() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
] as const;

// Alias for compatibility
export const APEBIT_CARTRIDGE_ABI = CARTRIDGE_ABI;

// Mining Claim Router ABI (minimal for claiming)
export const MINING_CLAIM_ROUTER_ABI = [
  'function claim((address wallet, address cartridge, uint256 tokenId, address rewardToken, uint256 rewardAmount, bytes32 workHash, uint64 attempts, bytes32 nonce, uint64 expiry) claimData, bytes signature)',
  'function allowedCartridge(address) view returns (bool)',
  'function signer() view returns (address)',
] as const;

// Contract addresses (will be set after deployment)
export const contracts = {
  apeBitToken: process.env.NEXT_PUBLIC_APEBIT_TOKEN_ADDRESS as `0x${string}`,
  miningClaimRouter: process.env.NEXT_PUBLIC_MINING_CLAIM_ROUTER_ADDRESS as `0x${string}`,
  apeBitCartridge: process.env.NEXT_PUBLIC_APEBIT_CARTRIDGE_ADDRESS as `0x${string}`,
} as const;
