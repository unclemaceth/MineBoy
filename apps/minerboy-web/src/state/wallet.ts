'use client'
import { create } from 'zustand'

type Source = 'glyph' | 'wc' | null

type WalletState = {
  externalAddress: `0x${string}` | null
  source: Source
  setExternalAddress: (addr: `0x${string}` | null, source: Source) => void
}

export const useWalletStore = create<WalletState>((set) => ({
  externalAddress: null,
  source: null,
  setExternalAddress: (addr, source) => set({ externalAddress: addr, source })
}))
