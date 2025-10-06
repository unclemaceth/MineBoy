import { Contract } from "ethers";
import erc20 from "../abis/erc20.js";
import { swapNativeForMnestr99 } from "../dex/camelot.js";
import { cfg } from "../config.js";
import { flywheel } from "../wallets.js";

/**
 * Settlement process after selling an NFT
 * 
 * 1. Swap 99% of APE balance to MNESTR (keep 1% for gas)
 * 2. Burn ALL MNESTR we received
 * 
 * This creates deflationary pressure on MNESTR supply!
 */
export async function settleBurn99() {
  const me = await flywheel.getAddress();

  console.log('[Settle] Starting 99% burn settlement...');

  // Step 1: Swap 99% APE -> MNESTR
  const { swapped } = await swapNativeForMnestr99({
    signer: flywheel,
    dexRouter: cfg.dexRouter,
    wape: cfg.wape,
    mnestr: cfg.mnestr
  });

  if (swapped === 0n) {
    console.log('[Settle] Nothing to settle');
    return { burned: 0n };
  }

  // Step 2: Burn all MNESTR we hold
  const m = new Contract(cfg.mnestr, erc20, flywheel);
  const mBal: bigint = await m.balanceOf(me);
  
  if (mBal > 0n) {
    console.log(`[Settle] Burning ${mBal} wei of MNESTR...`);
    const burnTx = await m.burn(mBal);
    await burnTx.wait();
    console.log(`[Settle:OK] Burned ${mBal} wei MNESTR!`);
    return { burned: mBal };
  }
  
  console.log('[Settle] No MNESTR to burn');
  return { burned: 0n };
}
