import { Wallet } from "ethers";
import { provider } from "./provider.js";
import { cfg } from "./config.js";

/**
 * Flywheel wallet signer
 * This is the bot's wallet that buys/sells NFTs and burns MNESTR
 */
export const flywheel = new Wallet(cfg.flywheelPk, provider);
