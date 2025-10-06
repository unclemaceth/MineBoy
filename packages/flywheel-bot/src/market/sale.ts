import { Contract } from "ethers";
import erc721 from "../abis/erc721.js";
import { cfg } from "../config.js";
import { flywheel } from "../wallets.js";

/**
 * Check if an NFT has been sold (no longer owned by us)
 * Returns true if someone else now owns it
 */
export async function wasSold(tokenId: string): Promise<boolean> {
  const nft = new Contract(cfg.npc, erc721, flywheel.provider);
  const owner = await nft.ownerOf(tokenId).catch(() => null);
  return owner?.toLowerCase() !== (await flywheel.getAddress()).toLowerCase();
}
