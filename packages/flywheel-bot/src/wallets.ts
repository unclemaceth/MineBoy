import { Wallet } from "ethers";
import { provider } from "./provider.js";
import { cfg } from "./config.js";

/**
 * Flywheel trading wallet
 * This wallet buys/sells NPCs and lists them
 */
export const flywheel = new Wallet(cfg.flywheelPk, provider);

/**
 * Flywheel treasury wallet
 * This wallet receives sale proceeds, swaps to MNESTR, and burns
 */
export const treasury = new Wallet(cfg.treasuryPk, provider);
