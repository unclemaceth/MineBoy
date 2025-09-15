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
