import { Alchemy, Network, AlchemyConfig } from 'alchemy-sdk';
import { CARTRIDGE_ADDRESSES, CURTIS_CHAIN_ID } from './contracts';

// Alchemy configuration for Curtis chain
const config: AlchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '',
  network: Network.ETH_MAINNET, // We'll override the RPC URL for Curtis
};

// Override the RPC URL for Curtis chain
const alchemy = new Alchemy({
  ...config,
  url: 'https://curtis.rpc.caldera.xyz/http'
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

    // Get owned NFTs for the cartridge contract
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress, {
      contractAddresses: [CARTRIDGE_ADDRESSES[CURTIS_CHAIN_ID]]
    });

    return nfts.ownedNfts.map(nft => ({
      tokenId: nft.tokenId,
      contractAddress: nft.contract.address,
      chainId: CURTIS_CHAIN_ID
    }));
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

    return metadata.raw?.metadata ? JSON.parse(metadata.raw.metadata as string) : null;
  } catch (error) {
    console.error('Error fetching cartridge metadata:', error);
    return null;
  }
}
