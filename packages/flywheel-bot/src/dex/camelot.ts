import { Contract, Wallet } from "ethers";
import univ2 from "../abis/univ2Router.js";

/**
 * Swap 99% of APE balance for MNESTR using Camelot DEX
 * Keeps ~1% APE for gas fees
 * 
 * This is the burn mechanism: we convert APE profits to MNESTR
 */
export async function swapNativeForMnestr99({
  signer,
  dexRouter,
  wape,
  mnestr
}: { signer: Wallet; dexRouter: string; wape: string; mnestr: string; }) {
  const me = await signer.getAddress();
  const bal = await signer.provider!.getBalance(me);
  
  if (bal === 0n) {
    console.log('[Swap] No APE balance to swap');
    return { swapped: 0n };
  }

  // Keep ~1% for gas, swap 99%
  const burnWei = (bal * 99n) / 100n;
  if (burnWei <= 0n) {
    console.log('[Swap] Balance too low to swap');
    return { swapped: 0n };
  }

  console.log(`[Swap] Swapping ${burnWei} wei APE (99%) for MNESTR...`);
  
  const router = new Contract(dexRouter, univ2, signer);
  const path = [wape, mnestr]; // WAPE -> MNESTR
  const deadline = Math.floor(Date.now() / 1000) + 900; // 15 min deadline

  const tx = await router.swapExactETHForTokens(
    0,        // amountOutMin (no slippage protection for now)
    path,
    me,
    deadline,
    { value: burnWei }
  );
  
  const rc = await tx.wait();
  console.log(`[Swap:OK] tx=${rc?.hash}`);
  
  return { swapped: burnWei };
}
