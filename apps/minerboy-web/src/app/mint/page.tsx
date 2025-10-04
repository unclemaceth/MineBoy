// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

// Force dynamic rendering and disable SSR
export const dynamic = 'force-dynamic';
export const ssr = false;
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import OpenConnectModalButton from '@/components/OpenConnectModalButton';
import MintNetworkGuard from '@/components/MintNetworkGuard';
import { useMintPrice } from '@/hooks/useMintPrice';
import { useBackendMint } from '@/hooks/useBackendMint';
import { useSpendChecks } from '@/hooks/useSpendChecks';
import { useContractState } from '@/hooks/useContractState';
import { formatEther } from 'viem';
import Link from 'next/link';
import { EXPLORER_BASE, APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from "../../lib/contracts";
import Stage from "@/components/Stage";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function MintPage() {
  const { address, isConnected } = useActiveAccount();
  const chainId = 33139; // ApeChain - we'll handle network switching separately if needed
  const { writeContract, isPending: isWritePending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  
  const [count, setCount] = useState(1);
  const [mintedTokenIds, setMintedTokenIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Mint page wallet state:', { isConnected, address, chainId, mounted });
  }, [isConnected, address, chainId, mounted]);

  // Get contract address for current chain
  const contractAddress = chainId ? CARTRIDGE_ADDRESSES[chainId] : null;
  const onApeChain = chainId === 33139; // APECHAIN
  const onCurtis = chainId === 33111; // CURTIS
  
  const canMint = mounted && isConnected && contractAddress && (onApeChain || onCurtis);

  // Fetch the actual mint price from the contract using the new hook
  const { data: mintPrice, error: priceError, isLoading: priceLoading } = useMintPrice();

  // Use the new safety hooks
  const { mint, isMinting, error: mintError, isReady } = useBackendMint();
  // Backend minting doesn't need spend checks
  const spendLoading = false;
  const enoughTotal = true;
  const { errorReason, isPaused, isSoldOut, hasReachedWalletLimit, isERC20Payment, needsApproval, isLoading: contractLoading } = useContractState();

  // Backend minting is free, no cost
  const totalCostWei = 0n;
  
  // Ensure errorReason is a string for rendering
  const displayErrorReason: string | null = errorReason ? String(errorReason) : null;

  const handleMint = async () => {
    setError(null);
    setMintedTokenIds([]);
    setIsChecking(true);
    
    try {
      console.log('Mint button clicked!', { isConnected, chainId, address, contractAddress });
      
      // Use backend minting
      const result = await mint();
      console.log('Mint successful:', result);
      
      // Add a mock token ID for display (backend doesn't return token ID)
      setMintedTokenIds([Date.now()]); // Use timestamp as mock ID
      
    } catch (err: any) {
      console.error('[Mint failed]', err);
      
      // Extract meaningful error message
      let errorMessage = 'Minting failed';
      
      if (err.message?.includes('timeout')) {
        errorMessage = 'Transaction check timed out - please try again';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

         // Handle successful transaction
         useEffect(() => {
           if (isConfirmed && hash) {
             // TODO: Parse actual token IDs from transaction logs
             console.log('Mint successful! TX:', hash);
           }
         }, [isConfirmed, hash]);


  return (
    <Stage>
      <ErrorBoundary>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px',
          fontFamily: 'monospace',
          color: '#c8ffc8',
          height: '100%'
        }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        maxWidth: '400px',
        marginBottom: '20px'
      }}>
        <Link 
          href="/" 
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
            color: '#c8ffc8',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 'bold',
            border: '2px solid #8a8a8a',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          ← BACK
        </Link>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          textAlign: 'center',
          flex: 1,
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
        }}>
          PICKAXE MINE CARTS
        </h1>
      </div>

      {/* Status Display */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '12px',
        background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        {!mounted ? (
          <div style={{ fontSize: '14px', opacity: 0.8 }}>LOADING...</div>
        ) : !isConnected ? (
          <OpenConnectModalButton>Connect Wallet</OpenConnectModalButton>
        ) : !(onApeChain || onCurtis) ? (
          <MintNetworkGuard />
        ) : !contractAddress ? (
          <div style={{ fontSize: '12px', color: '#ffa500', textAlign: 'center' }}>
            Mint contract not configured for this chain
          </div>
        ) : (
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            CONNECTED: <span style={{ fontFamily: 'monospace' }}>{address?.slice(0, 8)}...{address?.slice(-6)}</span>
          </div>
        )}
      </div>

      {/* Sold Out Message */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px 20px',
        background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
        border: '2px solid #4a7d5f',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        textAlign: 'center'
      }}>
                 {/* Sold Out Header */}
                 <div style={{
                   fontSize: '32px',
                   fontWeight: 'bold',
                   marginBottom: '24px',
                   color: '#ff6b6b',
                   textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                   letterSpacing: '2px'
                 }}>
                   SOLD OUT
                 </div>

        {/* Description */}
        <div style={{
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.6',
          color: '#c8ffc8',
          opacity: 0.9
        }}>
          All Pickaxe Mine Carts have been minted!
          <br />
          <br />
          Get yours on the secondary market:
        </div>

        {/* Magic Eden Button */}
        <a
          href="https://magiceden.io/collections/apechain/npc-picks"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
            color: '#c8ffc8',
            border: '2px solid #8a8a8a',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            textDecoration: 'none',
            textAlign: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #5a8d6f, #2a4d34)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          BUY ON MAGIC EDEN →
        </a>

        {/* Coming Soon Note */}
        <div style={{
          fontSize: '12px',
          marginTop: '24px',
          padding: '12px',
          background: 'rgba(74, 125, 95, 0.2)',
          borderRadius: '8px',
          border: '1px solid #4a7d5f',
          color: '#4a7d5f'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>COMING SOON</div>
          Basic Pickaxe minting will be available here in the future
        </div>

      </div>

      {/* Tip */}
      <div style={{
        fontSize: '12px',
        opacity: 0.7,
        marginTop: '20px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        TIP: Pickaxe Mine Carts come in 3 types with different mining speeds!
      </div>
        </div>
      </ErrorBoundary>
    </Stage>
  );
}
