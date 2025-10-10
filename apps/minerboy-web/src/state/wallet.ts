'use client'
import { create } from 'zustand'

type Source = 'glyph' | 'wc' | null

type WalletState = {
  externalAddress: `0x${string}` | null
  source: Source
  setExternalAddress: (addr: `0x${string}` | null, source: Source) => void
}

export const useWalletStore = create<WalletState>((set, get) => ({
  externalAddress: null,
  source: null,
  setExternalAddress: (addr, source) => {
    const current = get()
    // Guard: only update if actually changed (prevent thrashing)
    if (current.externalAddress === addr && current.source === source) {
      console.log('[useWalletStore] Skipping redundant update:', { addr, source })
      return
    }
    console.log('[useWalletStore] setExternalAddress called:', { addr, source })
    set({ externalAddress: addr, source })
    console.log('[useWalletStore] Store updated:', { externalAddress: addr, source })
  }
}))
