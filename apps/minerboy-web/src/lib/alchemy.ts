import { CARTRIDGE_ADDRESSES, CURTIS_CHAIN_ID } from './contracts';

export interface OwnedCartridge {
  tokenId: string;          // decimal string, normalized
  contractAddress: `0x${string}`;
  chainId: number;
}

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!;
const CURTIS_BASE = `https://apechain-curtis.g.alchemy.com/v2/${ALCHEMY_KEY}`;

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

    const contract = CARTRIDGE_ADDRESSES[CURTIS_CHAIN_ID] as `0x${string}`;
    const url = `${CURTIS_BASE}/getNFTsForOwner?owner=${walletAddress}&contractAddresses[]=${contract}&withMetadata=true&pageSize=100`;

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
      
      return {
        tokenId: normalizedTokenId,
        contractAddress: (nft.contract?.address ?? contract) as `0x${string}`,
        chainId: CURTIS_CHAIN_ID,
      };
    });
    
    console.log('Final Alchemy result:', result);
    return result;
  } catch (e) {
    console.error('Error fetching owned cartridges:', e);
    return [];
  }
}

// Optional: remove for now; Curtis + SDK config is finicky.
// If you keep metadata, prefer the REST endpoint:
// GET {CURTIS_BASE}/getNFTMetadata?contractAddress=...&tokenId=...
export async function getCartridgeMetadata(_tokenId: string) {
  return null;
}