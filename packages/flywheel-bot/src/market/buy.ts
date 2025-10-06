import { flywheel } from "../wallets.js";
import { Contract, parseEther } from "ethers";
import erc721 from "../abis/erc721.js";
import { cfg } from "../config.js";

/**
 * Check if we own a specific NFT
 */
async function verifyOwnership(tokenId: string): Promise<boolean> {
  const nft = new Contract(cfg.npc, erc721, flywheel.provider);
  const owner = await nft.ownerOf(tokenId).catch(() => null);
  return owner?.toLowerCase() === (await flywheel.getAddress()).toLowerCase();
}

/**
 * Execute a buy transaction using raw calldata
 * This sends the transaction to the market router
 */
export async function executeListingRaw({
  to,
  data,
  valueWei
}: { to: string; data: string; valueWei: string; }) {
  const tx = await flywheel.sendTransaction({
    to,
    data,
    value: BigInt(valueWei)
  });
  return await tx.wait();
}

/**
 * Check if we can afford to buy at this price
 * Includes a small buffer (1%) for gas
 */
export async function canAfford(priceNative: string, bufferBps: number): Promise<boolean> {
  const bal = await flywheel.provider!.getBalance(await flywheel.getAddress());
  const need = BigInt(parseEther((Number(priceNative) * (1 + bufferBps / 10000)).toFixed(6)).toString());
  return bal >= need;
}

export { verifyOwnership };
