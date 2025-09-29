'use client';

import { useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { apechain } from '@/lib/wallet';
import { useWalletModal } from '@/state/walletModal'; // your zustand store

// Custom Glyph button component
function CustomGlyphButton({ onDone }: { onDone?: () => void }) {
  const { connectors, connect, isPending, error } = useConnect();
  
  const handleConnect = async () => {
    try {
      console.log('[Glyph] Custom button clicked');
      console.log('[Glyph] Available wagmi connectors:', connectors.map(c => ({ id: c.id, name: c.name })));
      
      // Find any connector that might be Glyph-related
      const glyphConnector = connectors.find(c => 
        c.id === 'glyph' || 
        c.name === 'Glyph' || 
        c.name.toLowerCase().includes('glyph') ||
        c.id.toLowerCase().includes('glyph')
      );
      
      if (glyphConnector) {
        console.log('[Glyph] Found Glyph connector in wagmi:', { id: glyphConnector.id, name: glyphConnector.name });
        console.log('[Glyph] Connecting with wagmi Glyph connector...');
        
        // Use wagmi to connect with Glyph on ApeChain
        await connect({ connector: glyphConnector, chainId: apechain.id });
        console.log('[Glyph] Wagmi connection successful!');
        onDone?.();
      } else {
        console.log('[Glyph] No Glyph connector found in wagmi connectors');
        console.log('[Glyph] Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })));
      }
    } catch (err) {
      console.error('[Glyph] Connection error:', err);
    }
  };
  
  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <span>
        {isPending ? 'Connecting...' : error ? 'Connection Failed' : 'Continue with Glyph'}
      </span>
    </button>
  );
}

export default function WalletConnectionModal() {
  const { isOpen, close } = useWalletModal();
  const { open } = useWeb3Modal();
  const { isConnected, address } = useAccount();

  // Debug logging
  useEffect(() => {
    console.log('WalletConnectionModal state:', { isOpen, isConnected, address: address?.slice(0, 8) + '...' + address?.slice(-6) });
  }, [isOpen, isConnected, address]);

  // auto-close if connection already happened (belt and braces)
  useEffect(() => { if (isConnected && isOpen) close(); }, [isConnected, isOpen, close]);

  if (!isOpen) return null;

  const onConnectClick = () => {
    console.log('WalletConnectionModal: Closing wrapper modal and opening Web3Modal');
    // close *our* wrapper first so you don't see 2 stacked modals
    close();
    // then open Web3Modal
    setTimeout(() => open(), 0);
  };

  return (
    <GlyphWalletProvider chains={[apechain]} askForSignature={false}>
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

          {/* GLYPH: Use wagmi connector */}
          <div 
            onClick={() => {
              console.log('WalletConnectionModal: Closing wrapper modal for Glyph');
              close();
            }}
          >
            <CustomGlyphButton onDone={close} />
          </div>
        </div>
      </div>
    </GlyphWalletProvider>
  );
}