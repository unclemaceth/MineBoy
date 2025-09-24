import { Alchemy, Network, AlchemyConfig } from 'alchemy-sdk';
import { CARTRIDGE_ADDRESSES, CURTIS_CHAIN_ID } from './contracts';

// Alchemy configuration for Curtis chain
const alchemy = new Alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '',
  url: 'https://apechain-curtis.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs'
});

export interface OwnedCartridge {
  tokenId: string;
  contractAddress: string;
  chainId: number;
}

export async function getOwnedCartridges(walletAddress: string): Promise<OwnedCartridge[]> {
  try {
    if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
      console.warn('Alchemy API key not configured');
      return [];
    }

    console.log('Fetching cartridges for:', walletAddress);
    console.log('Contract address:', CARTRIDGE_ADDRESSES[CURTIS_CHAIN_ID]);

    // Use direct REST API for Curtis chain
    const url = `https://apechain-curtis.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs/getNFTsForOwner?owner=${walletAddress}&contractAddresses[]=${CARTRIDGE_ADDRESSES[CURTIS_CHAIN_ID]}&withMetadata=true&pageSize=100`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Alchemy response:', data);

    return data.ownedNfts?.map((nft: any) => ({
      tokenId: nft.tokenId,
      contractAddress: nft.contract.address,
      chainId: CURTIS_CHAIN_ID
    })) || [];
  } catch (error) {
    console.error('Error fetching owned cartridges:', error);
    return [];
  }
}

export async function getCartridgeMetadata(tokenId: string): Promise<{
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
} | null> {
  try {
    if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
      return null;
    }

    const metadata = await alchemy.nft.getNftMetadata(
      CARTRIDGE_ADDRESSES[CURTIS_CHAIN_ID],
      tokenId
    );

    return metadata.raw?.metadata ? JSON.parse(metadata.raw.metadata as unknown as string) : null;
  } catch (error) {
    console.error('Error fetching cartridge metadata:', error);
    return null;
  }
}
