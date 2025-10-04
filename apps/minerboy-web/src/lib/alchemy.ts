import { CARTRIDGE_ADDRESSES, APECHAIN_CHAIN_ID } from './contracts';

export interface PickaxeMetadata {
  type: string;              // "The DripAxe", "The Morgul PickHammer", "Blue Steel"
  multiplier: number;        // 4, 3, 2
  oresMined: number;
  goldMined: number;
  videoUrl: string;          // /dripaxe.mp4, /pickhammer.mp4, /bluesteel.mp4
  hashRate: number;          // 8000, 7000, 6000
  fallbackPng: string;       // /mineboydiamond.png, /mineboypickhammer.png, /mineboysteel.png
}

export interface OwnedCartridge {
  tokenId: string;          // decimal string, normalized
  contractAddress: `0x${string}`;
  chainId: number;
  metadata?: PickaxeMetadata; // Pickaxe metadata
}

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!;
const APECHAIN_BASE = `https://apechain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
console.log('Alchemy base URL:', APECHAIN_BASE);

// Pickaxe type mapping with fallback PNGs
const PICKAXE_TYPE_MAP: Record<string, { videoUrl: string; hashRate: number; fallbackPng: string }> = {
  "The DripAxe": { videoUrl: "/dripaxe.mp4", hashRate: 8000, fallbackPng: "/mineboydiamond.png" },
  "The Morgul PickHammer": { videoUrl: "/pickhammer.mp4", hashRate: 7000, fallbackPng: "/mineboypickhammer.png" },
  "Blue Steel": { videoUrl: "/bluesteel.mp4", hashRate: 6000, fallbackPng: "/mineboysteel.png" },
  "The Blue Steel": { videoUrl: "/bluesteel.mp4", hashRate: 6000, fallbackPng: "/mineboysteel.png" }, // Alternative naming
};

function parsePickaxeMetadata(attributes: any[]): PickaxeMetadata | undefined {
  if (!attributes || !Array.isArray(attributes)) return undefined;

  let type = "";
  let multiplier = 0;
  let oresMined = 0;
  let goldMined = 0;

  for (const attr of attributes) {
    if (attr.trait_type === "Type") {
      type = attr.value;
    } else if (attr.trait_type === "Multiplier") {
      multiplier = Number(attr.value) || 0;
    } else if (attr.trait_type === "Ores Mined") {
      oresMined = Number(attr.value) || 0;
    } else if (attr.trait_type === "Gold Mined") {
      goldMined = Number(attr.value) || 0;
    }
  }

  if (!type || !PICKAXE_TYPE_MAP[type]) {
    console.warn('[PICKAXE] Unknown pickaxe type:', type);
    return undefined;
  }

  const { videoUrl, hashRate, fallbackPng } = PICKAXE_TYPE_MAP[type];

  return {
    type,
    multiplier,
    oresMined,
    goldMined,
    videoUrl,
    hashRate,
    fallbackPng,
  };
}

function hexToDecString(id: any) {
  // Handles "1", "0x1", or big hex strings, or objects
  if (!id) return '';
  
  // Convert to string first
  const idStr = String(id);
  
  // Skip if it's already a decimal number
  if (/^\d+$/.test(idStr)) return idStr;
  
  // Handle hex strings
  const clean = idStr.startsWith('0x') ? idStr : `0x${idStr}`;
  
  try {
    return BigInt(clean).toString(10);
  } catch (e) {
    console.warn('Failed to convert tokenId to decimal:', id, e);
    return idStr; // fallback to original string
  }
}

export async function getOwnedCartridges(walletAddress: string): Promise<OwnedCartridge[]> {
  try {
    if (!ALCHEMY_KEY) {
      console.warn('Alchemy API key not configured');
      return [];
    }

    const contract = CARTRIDGE_ADDRESSES[APECHAIN_CHAIN_ID] as `0x${string}`;
    console.log('Alchemy query - Contract address:', contract);
    console.log('Alchemy query - Chain ID:', APECHAIN_CHAIN_ID);
    console.log('Alchemy query - Wallet:', walletAddress);
    const url = `${APECHAIN_BASE}/getNFTsForOwner?owner=${walletAddress}&contractAddresses[]=${contract}&withMetadata=true&pageSize=100`;
    console.log('Alchemy query - URL:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);

    const data = await res.json();
    console.log('Alchemy response:', data);

    // Alchemy may use ownedNfts / ownedNfts[]; guard for both
    const list = data.ownedNfts ?? data.ownedNfts ?? [];
    console.log('Alchemy NFT list:', list);

    const result = list.map((nft: any, index: number) => {
      console.log(`NFT ${index}:`, nft);
      console.log(`NFT ${index} keys:`, Object.keys(nft));
      
      // Alchemy uses id object with tokenId property
      const tokenIdValue = nft.id?.tokenId || nft.tokenId || nft.token_id || nft.id;
      console.log(`NFT ${index} raw tokenId:`, tokenIdValue);
      
      // Convert to string if it's an object
      const tokenIdStr = typeof tokenIdValue === 'object' ? tokenIdValue?.tokenId || tokenIdValue?.hex || String(tokenIdValue) : String(tokenIdValue);
      console.log(`NFT ${index} tokenId string:`, tokenIdStr);
      
      const normalizedTokenId = hexToDecString(tokenIdStr);
      console.log(`NFT ${index} tokenId: ${tokenIdStr} -> normalized: ${normalizedTokenId}`);
      
      // Parse pickaxe metadata from attributes
      const attributes = nft.metadata?.attributes || nft.raw?.metadata?.attributes || [];
      const pickaxeMetadata = parsePickaxeMetadata(attributes);
      
      if (pickaxeMetadata) {
        console.log(`NFT ${index} pickaxe metadata:`, pickaxeMetadata);
      }
      
      return {
        tokenId: normalizedTokenId,
        contractAddress: (nft.contract?.address ?? contract) as `0x${string}`,
        chainId: APECHAIN_CHAIN_ID,
        metadata: pickaxeMetadata,
      };
    });
    
    console.log('Final Alchemy result:', result);
    return result;
  } catch (e) {
    console.error('Error fetching owned cartridges:', e);
    return [];
  }
}

// Optional: remove for now; ApeChain + SDK config is finicky.
// If you keep metadata, prefer the REST endpoint:
// GET {APECHAIN_BASE}/getNFTMetadata?contractAddress=...&tokenId=...
export async function getCartridgeMetadata(_tokenId: string) {
  return null;
}