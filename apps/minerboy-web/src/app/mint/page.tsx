// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

// Force dynamic rendering and disable SSR
export const dynamic = 'force-dynamic';
export const ssr = false;
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import OpenConnectModalButton from '@/components/OpenConnectModalButton';
import MintNetworkGuard from '@/components/MintNetworkGuard';
import { useMintPrice } from '@/hooks/useMintPrice';
import { useSafeMint } from '@/hooks/useSafeMint';
import { useSpendChecks } from '@/hooks/useSpendChecks';
import { useContractState } from '@/hooks/useContractState';
import { formatEther } from 'viem';
import Link from 'next/link';
import { EXPLORER_BASE, APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from "../../lib/contracts";
import Stage from "@/components/Stage";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function MintPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContract, isPending: isMinting, data: hash } = useWriteContract();
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
  const onApeChain = chainId === 33133; // APECHAIN
  const onCurtis = chainId === 33111; // CURTIS
  
  const canMint = mounted && isConnected && contractAddress && (onApeChain || onCurtis);

  // Fetch the actual mint price from the contract using the new hook
  const { data: mintPrice, error: priceError, isLoading: priceLoading } = useMintPrice();

  // Use the new safety hooks
  const { simulate, mint, isReady, estTotal, value } = useSafeMint(count);
  const { bal, feeFormatted, enoughForFee, enoughForValue, enoughTotal, isLoading: spendLoading, gasEstimateError } = useSpendChecks(
    contractAddress || undefined, 
    value, 
    count
  );
  const { errorReason, isPaused, isSoldOut, hasReachedWalletLimit, isERC20Payment, needsApproval, isLoading: contractLoading } = useContractState();

  const totalCostWei = value;
  
  // Ensure errorReason is a string for rendering
  const displayErrorReason: string | null = errorReason ? String(errorReason) : null;

  const handleMint = async () => {
    setError(null);
    setMintedTokenIds([]);
    setIsChecking(true);
    
    try {
      console.log('Mint button clicked!', { isConnected, chainId, address, contractAddress });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout while simulating')), 8000)
      );
      
      // Preflight check with timeout
      const simulatePromise = simulate();
      await Promise.race([simulatePromise, timeoutPromise]);
      
      // If simulation passes, send the transaction
      const txHash = await mint();
      console.log('TX sent:', txHash);
      
    } catch (err: any) {
      console.error('[Mint preflight failed]', err);
      
      // Extract meaningful error message from viem
      let errorMessage = 'Transaction reverted';
      
      if (err.message?.includes('timeout')) {
        errorMessage = 'Transaction check timed out - please try again';
      } else if (err.shortMessage) {
        errorMessage = err.shortMessage;
      } else if (err.details) {
        errorMessage = err.details;
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
          MINT CARTRIDGES
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

      {/* Mint Interface */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '20px',
        background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
        border: '2px solid #4a7d5f',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
      }}>
                 {/* Single Mint Info */}
                 <div style={{
                   fontSize: '14px',
                   fontWeight: 'bold',
                   marginBottom: '16px',
                   textAlign: 'center',
                   color: '#4a7d5f'
                 }}>
                   SINGLE CARTRIDGE MINT
                 </div>

        {/* Price Info */}
        <div style={{
          fontSize: '12px',
          opacity: 0.8,
          marginBottom: '20px',
          textAlign: 'center'
        }}>
                 MAX PER TX: 1
          {priceLoading ? (
            <span style={{ color: '#ffa500' }}> • LOADING PRICE...</span>
          ) : priceError ? (
            <span style={{ color: '#ff6b6b' }}> • PRICE ERROR</span>
          ) : estTotal ? (
            <>
              {" • "}PRICE: <span style={{ fontFamily: 'monospace' }}>{formatEther(mintPrice || BigInt(0))} APE</span>
              {" • "}TOTAL: <span style={{ fontFamily: 'monospace' }}>{estTotal} APE</span>
              {feeFormatted && (
                <span> • FEE: ~<span style={{ fontFamily: 'monospace' }}>{feeFormatted} APE</span></span>
              )}
            </>
                   ) : (
                     <span style={{ color: '#ffa500' }}> • PRICE: 0.01 APE (fallback)</span>
                   )}
        </div>

        {/* Contract State Warnings */}
        {displayErrorReason && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ff6b6b'
          }}>
            ! {displayErrorReason}
          </div>
        )}

        {/* ERC20 Approval Warning */}
        {needsApproval && (
          <div style={{
            fontSize: '12px',
            color: '#ffa500',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 165, 0, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ffa500'
          }}>
            ! ERC20 approval required for token payments
          </div>
        )}

        {/* ERC20 Payment Info */}
        {isERC20Payment && (
          <div style={{
            fontSize: '12px',
            color: '#4a7d5f',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(74, 125, 95, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #4a7d5f'
          }}>
            i This contract uses ERC20 token payments
          </div>
        )}

        {/* Gas Estimation Warning */}
        {gasEstimateError && (
          <div style={{
            fontSize: '12px',
            color: '#ffa500',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 165, 0, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ffa500'
          }}>
            ! Gas estimation failed - transaction may still work
          </div>
        )}

        {/* Balance Warnings */}
        {!enoughForValue && bal && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ff6b6b'
          }}>
            ! Not enough APE for mint (need {estTotal} APE, have {formatEther(bal.value)} APE)
          </div>
        )}

        {!enoughForFee && bal && feeFormatted && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: '4px',
            textAlign: 'center',
            border: '1px solid #ff6b6b'
          }}>
            ! Not enough APE for network fee (need ~{feeFormatted} APE)
          </div>
        )}

        {/* Mint Button */}
        <button
          disabled={
            !canMint || 
            isMinting || 
            isConfirming || 
            isChecking ||
            !isReady || 
            !enoughTotal || 
            spendLoading || 
            contractLoading ||
            !!needsApproval ||
            !!error
          }
          onClick={handleMint}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            background: canMint && !isMinting && !isConfirming && !isChecking && isReady && enoughTotal && !spendLoading && !contractLoading && !needsApproval && !error
              ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)' 
              : 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
            color: '#c8ffc8',
            border: '2px solid #8a8a8a',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: canMint && !isMinting && !isConfirming && !isChecking && isReady && enoughTotal && !spendLoading && !contractLoading && !needsApproval && !error ? 'pointer' : 'not-allowed',
            opacity: canMint && !isMinting && !isConfirming && !isChecking && isReady && enoughTotal && !spendLoading && !contractLoading && !needsApproval && !error ? 1 : 0.5,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            marginBottom: '16px'
          }}
        >
          {isChecking ? 'CHECKING…' :
           isMinting ? 'MINTING…' :
           isConfirming ? 'CONFIRMING…' :
           error ? 'CANNOT MINT' :
           !enoughTotal ? 'INSUFFICIENT BALANCE' :
           needsApproval ? 'NEEDS APPROVAL' :
           displayErrorReason ? 'CANNOT MINT' :
                     'MINT CARTRIDGE'}
        </button>

        {/* Transaction Hash */}
        {hash && (
          <div style={{
            fontSize: '12px',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            textAlign: 'center',
            wordBreak: 'break-all',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%'
          }}>
            TX: {EXPLORER_BASE ? (
              <a
                style={{ color: '#4a7d5f', textDecoration: 'underline' }}
                href={`${EXPLORER_BASE}/tx/${hash}`}
                target="_blank"
              >
                {hash.slice(0, 8)}…{hash.slice(-6)}
              </a>
            ) : (
              <span style={{ fontFamily: 'monospace' }}>{hash.slice(0, 8)}…{hash.slice(-6)}</span>
            )}
          </div>
        )}

        {/* Token IDs */}
        {!!mintedTokenIds.length && (
          <div style={{
            fontSize: '12px',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            MINTED: <span style={{ fontFamily: 'monospace' }}>{mintedTokenIds.join(", ")}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontSize: '12px',
            color: '#ff6b6b',
            marginBottom: '12px',
            padding: '8px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

      </div>

      {/* Tip */}
      <div style={{
        fontSize: '12px',
        opacity: 0.7,
        marginTop: '20px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        TIP: Check your wallet&apos;s explorer for ERC-721 transfers to find token IDs
      </div>
        </div>
      </ErrorBoundary>
    </Stage>
  );
}
