'use client';

import { useEffect, useRef } from 'react';
import { useDisconnect } from 'wagmi';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useNativeGlyphConnection } from '@use-glyph/sdk-react';
import { useWalletModal } from '@/state/walletModal'; // your zustand store

// Clean up stale WalletConnect sessions
function removeStaleWalletConnect() {
  try {
    const keys = Object.keys(localStorage)
    for (const k of keys) {
      if (
        k.startsWith('wc@') ||
        k.startsWith('walletconnect') ||
        k === 'wagmi.store' ||
        k === 'WALLETCONNECT_DEEPLINK_CHOICE'
      ) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
}

// Custom Glyph button component
function CustomGlyphButton({ onDone }: { onDone?: () => void }) {
  const { connect } = useNativeGlyphConnection();
  
  const handleConnect = async () => {
    try {
      console.log('[Glyph] Custom button clicked');
      await connect(); // Opens Glyph popup; on success, wagmi useAccount() gets the address
      console.log('[Glyph] Connection successful!');
      onDone?.();
    } catch (err) {
      console.error('[Glyph] Connection error:', err);
    }
  };
  
  return (
    <button
      onClick={handleConnect}
      className="h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold flex items-center justify-center gap-3"
    >
      {/* Glyph Logo */}
      <div className="w-6 h-6 flex items-center justify-center">
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="text-white"
        >
          <path 
            d="M12 2L2 7L12 12L22 7L12 2Z" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M2 17L12 22L22 17" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M2 12L12 17L22 12" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span>Create Wallet with Glyph</span>
    </button>
  );
}

export default function WalletConnectionModal() {
  const { isOpen, close } = useWalletModal();
  const { isConnected, address } = useActiveAccount();
  const { disconnectAsync } = useDisconnect();
  const openingRef = useRef(false);
  
  // Use Web3Modal hook - it should be initialized by the time this component mounts
  const { open } = useWeb3Modal();
  
  // Use Glyph connection hook
  const { connect: connectGlyph } = useNativeGlyphConnection();

  // Debug logging
  useEffect(() => {
    console.log('WalletConnectionModal state:', { isOpen, isConnected, address: address?.slice(0, 8) + '...' + address?.slice(-6) });
  }, [isOpen, isConnected, address]);

  // auto-close if connection already happened (belt and braces)
  useEffect(() => { if (isConnected && isOpen) close(); }, [isConnected, isOpen, close]);

  if (!isOpen) return null;

  const onConnectClick = async () => {
    if (openingRef.current) return; // Prevent duplicate requests
    openingRef.current = true;
    
    try {
      console.log('WalletConnectionModal: Opening Web3Modal directly');
      // Clean up stale sessions
      removeStaleWalletConnect();
      
      // close our modal and open Web3Modal
      close();
      await open();
    } finally {
      openingRef.current = false;
    }
  };

  const onGlyphClick = async () => {
    try {
      console.log('WalletConnectionModal: Connecting with Glyph');
      await connectGlyph();
      close(); // Close our modal after successful connection
    } catch (err) {
      console.error('Glyph connection error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-[520px] max-w-[90vw] rounded-2xl bg-[#1c1c1c] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
          <button onClick={close} className="rounded p-1 text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-3">
          <button
            onClick={onConnectClick}
            className="h-12 w-full rounded-xl bg-[#4BE477] font-semibold text-black hover:opacity-90 flex items-center justify-center gap-2"
          >
            <span>🌐</span>
            <span>WalletConnect (MetaMask, etc.)</span>
          </button>

          <button
            onClick={onGlyphClick}
            className="h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold flex items-center justify-center gap-3"
          >
            {/* Glyph Logo */}
            <div className="w-6 h-6 flex items-center justify-center">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path 
                  d="M12 2L2 7L12 12L22 7L12 2Z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M2 17L12 22L22 17" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M2 12L12 17L22 12" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Create Wallet with Glyph</span>
          </button>
        </div>
      </div>
    </div>
  );
}