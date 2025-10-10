'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveDisconnect } from '@/hooks/useActiveDisconnect';
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
  const { disconnectWallet } = useActiveDisconnect();
  const openingRef = useRef(false);
  const connectingRef = useRef(false); // 🔒 Prevent rapid connect/disconnect cycles
  
  // Use Web3Modal hook - it should be initialized by the time this component mounts
  const { open } = useWeb3Modal();
  
  // Use Glyph connection hook
  const { connect: connectGlyph } = useNativeGlyphConnection();

  // Debug logging
  useEffect(() => {
    const addrDisplay = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'undefined...undefined'
    console.log('WalletConnectionModal state:', { isOpen, isConnected, address: addrDisplay });
  }, [isOpen, isConnected, address]);

  // auto-close if connection already happened (belt and braces)
  // 🔒 Guard: only close if we're not mid-connection to avoid race
  useEffect(() => { 
    if (isConnected && isOpen && !connectingRef.current) {
      console.log('[WalletConnectionModal] Connection detected, closing modal')
      close()
    }
  }, [isConnected, isOpen, close]);

  if (!isOpen) return null;

  const onConnectClick = async () => {
    if (openingRef.current || connectingRef.current) return; // Prevent duplicate requests
    openingRef.current = true;
    connectingRef.current = true; // 🔒 Lock to prevent disconnect during connection
    
    try {
      console.log('WalletConnectionModal: Opening Web3Modal directly');
      // Clean up stale sessions
      removeStaleWalletConnect();
      
      // close our modal and open Web3Modal
      close();
      await open();
      
      // Wait a bit for connection to settle before releasing lock
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      console.error('Web3Modal connection error:', err)
    } finally {
      openingRef.current = false;
      connectingRef.current = false; // 🔓 Release lock
    }
  };

  const onGlyphClick = async () => {
    if (connectingRef.current) return; // Prevent duplicate requests
    connectingRef.current = true; // 🔒 Lock to prevent disconnect during connection
    
    try {
      console.log('WalletConnectionModal: Connecting with Glyph');
      await connectGlyph();
      
      // Wait a bit for connection to settle
      await new Promise(resolve => setTimeout(resolve, 500))
      close(); // Close our modal after successful connection
    } catch (err) {
      console.error('Glyph connection error:', err);
    } finally {
      connectingRef.current = false; // 🔓 Release lock
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-[520px] max-w-[90vw] rounded-2xl bg-[#1c1c1c] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
          <button onClick={close} className="rounded p-1 text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          {/* WEB3 Degens Section */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 text-center">
              For WEB3 Degens who already know about wallets, seed phrases and Apeing In without reading!
            </p>
            <button
              onClick={onConnectClick}
              className="h-12 w-full rounded-xl bg-[#4BE477] font-semibold text-black hover:opacity-90 flex items-center justify-center gap-2"
            >
              <span>🌐</span>
              <span>WalletConnect (MetaMask, etc.)</span>
            </button>
          </div>

          {/* N00bs Section */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 text-center">
              For N00bs who don't know nuthin'! Make a wallet with your Social login, Gmail, Email, etc.
            </p>
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
              <span>Connect with Glyph</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}