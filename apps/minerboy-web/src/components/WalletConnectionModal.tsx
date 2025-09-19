'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { LoginButton } from '@use-glyph/sdk-react';
import { useWalletModal } from '@/state/walletModal'; // your zustand store

export default function WalletConnectionModal() {
  const { isOpen, close } = useWalletModal();
  const { open } = useWeb3Modal();
  const { isConnected } = useAccount();

  // auto-close if connection already happened (belt and braces)
  useEffect(() => { if (isConnected && isOpen) close(); }, [isConnected, isOpen, close]);

  if (!isOpen) return null;

  const onConnectClick = () => {
    // close *our* wrapper first so you don't see 2 stacked modals
    close();
    // then open Web3Modal
    setTimeout(() => open(), 0);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-[520px] max-w-[90vw] rounded-2xl bg-[#1c1c1c] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
          <button onClick={close} className="rounded p-1 text-zinc-400 hover:text-white">✕</button>
        </div>

        <button
          onClick={onConnectClick}
          className="mb-3 h-12 w-full rounded-xl bg-[#4BE477] font-semibold text-black hover:opacity-90"
        >
          Connect Wallet
        </button>

        {/* GLYPH: Custom button that opens Glyph */}
        <button
          onClick={() => {
            // Close our modal first
            close();
            // Open Glyph connection
            if (typeof window !== 'undefined') {
              // For now, just show an alert - will implement proper Glyph connection
              alert('Glyph connection will be implemented once basic wallet flow is working');
            }
          }}
          className="h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold"
        >
          Glyph
        </button>
      </div>
    </div>
  );
}