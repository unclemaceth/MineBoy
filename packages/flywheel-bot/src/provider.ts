import { JsonRpcProvider } from "ethers";
import { cfg } from "./config.js";

/**
 * Blockchain connection provider
 * Connects to ApeChain RPC
 */
export const provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
