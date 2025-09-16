// src/lib/hex.ts
export type Hex = `0x${string}`;

export function to0x(s: string): Hex {
  return (s.startsWith("0x") ? s : `0x${s}`) as Hex;
}

export function hexFrom(v: string | number | bigint | undefined | null, padTo?: number): Hex {
  if (v === undefined || v === null) return ("0x" + "0".repeat(padTo ?? 0)) as Hex;
  if (typeof v === "string") return to0x(v);
  if (typeof v === "bigint") return ("0x" + v.toString(16).padStart(padTo ?? 0, "0")) as Hex;
  if (typeof v === "number") return ("0x" + v.toString(16).padStart(padTo ?? 0, "0")) as Hex;
  // fallback
  return to0x(String(v));
}

export const ZERO32: Hex = ("0x" + "0".repeat(64)) as Hex;
