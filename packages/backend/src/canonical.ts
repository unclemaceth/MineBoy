import { getAddress } from "viem";

/**
 * Canonical cartridge key generation for consistent string comparison
 * across the two-tier session system.
 */

export function toTokenIdString(x: string | number | bigint): string {
  // Accept "4", 4, 0x04, BigInt(4), etc.
  const bi = typeof x === "bigint" ? x : BigInt(x);
  return bi.toString(10); // Always return decimal string
}

export function canonicalizeCartridge(input: {
  chainId: string | number;
  contract: string;
  tokenId: string | number | bigint;
}) {
  const chainId = typeof input.chainId === "string" ? Number(input.chainId) : input.chainId;
  if (!Number.isSafeInteger(chainId)) {
    throw new Error(`Invalid chainId: ${input.chainId}`);
  }
  
  const contract = getAddress(input.contract).toLowerCase();
  const tokenId = toTokenIdString(input.tokenId);
  
  return { chainId, contract, tokenId };
}

export function cartKey(c: { chainId: number; contract: string; tokenId: string }): string {
  return `${c.chainId}:${c.contract}:${c.tokenId}`;
}
