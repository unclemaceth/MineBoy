"use client";

import { GlyphWalletProvider } from "@use-glyph/sdk-react";
import type { Chain } from "viem";
import { apeChain, mainnet, base, curtis } from "viem/chains";

const supportedChains: [Chain, ...Chain[]] = [apeChain, mainnet, base, curtis];

export default function GlyphWalletWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GlyphWalletProvider chains={supportedChains} askForSignature={false}>
      {children}
    </GlyphWalletProvider>
  );
}
