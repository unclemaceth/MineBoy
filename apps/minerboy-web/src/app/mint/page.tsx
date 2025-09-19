"use client";

import { useEffect, useMemo, useState } from "react";

// Force dynamic rendering and disable SSR
export const dynamic = 'force-dynamic';
export const ssr = false;
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import OpenConnectModalButton from '@/components/OpenConnectModalButton';
import MintNetworkGuard from '@/components/MintNetworkGuard';
import { useMintPrice } from '@/hooks/useMintPrice';
import { formatEther } from 'viem';
import Link from 'next/link';
import { EXPLORER_BASE, APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from "../../lib/contracts";
import Stage from "@/components/Stage";

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

  const totalCostWei = useMemo(() => {
    if (!mintPrice || typeof mintPrice !== 'bigint') return BigInt(0);
    return mintPrice * BigInt(count);
  }, [mintPrice, count]);

  const handleMint = async () => {
    setError(null);
    setMintedTokenIds([]);
    try {
      console.log('Mint button clicked!', { isConnected, chainId, address, contractAddress });
      
      if (!isConnected) throw new Error("Connect your wallet");
      if (!contractAddress) throw new Error("Contract not available on this network");
      if (!(onApeChain || onCurtis)) throw new Error("Switch to ApeChain or Curtis network");

      if (count < 1 || count > 10) throw new Error("Choose 1–10 cartridges");

      // Check if we have enough balance for the mint
      if (totalCostWei && totalCostWei > BigInt(0)) {
        console.log(`Minting will cost ${formatEther(totalCostWei)} APE`);
      } else {
        console.log('Minting is free (0 APE)');
      }

      console.log('Calling writeContract with:', {
        address: contractAddress,
        functionName: 'mint',
        args: [BigInt(count)],
        value: totalCostWei,
        valueInEther: formatEther(totalCostWei)
      });

      // Try to call the contract - this should trigger wallet popup
      console.log('About to call writeContract...');
      
      // writeContract is a void function that triggers the transaction
      if (!address) throw new Error("No wallet address");
      
      writeContract({
        address: contractAddress,
        abi: APEBIT_CARTRIDGE_ABI,
        functionName: 'mint',
        args: [BigInt(count)], // mint(uint256 quantity) - mint specified quantity
        value: totalCostWei,
      });
      
      console.log('writeContract called - wallet popup should appear');
    } catch (err: unknown) {
      console.error('Mint error:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isConfirmed && hash) {
      setMintedTokenIds([1, 2, 3]); // Mock token IDs for now
    }
  }, [isConfirmed, hash]);


  return (
    <Stage>
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
        {/* Quantity Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>QUANTITY</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
                border: '2px solid #8a8a8a',
                color: '#c8ffc8',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isMinting || count <= 1 ? 'not-allowed' : 'pointer',
                opacity: isMinting || count <= 1 ? 0.5 : 1
              }}
              disabled={isMinting || count <= 1}
              onClick={() => setCount(Math.max(1, count - 1))}
            >
              –
            </button>
            <div style={{
              width: '48px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {count}
            </div>
            <button
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
                border: '2px solid #8a8a8a',
                color: '#c8ffc8',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isMinting || count >= 10 ? 'not-allowed' : 'pointer',
                opacity: isMinting || count >= 10 ? 0.5 : 1
              }}
              disabled={isMinting || count >= 10}
              onClick={() => setCount(Math.min(10, count + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* Price Info */}
        <div style={{
          fontSize: '12px',
          opacity: 0.8,
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          MAX PER TX: 10
          {priceLoading ? (
            <span style={{ color: '#ffa500' }}> • LOADING PRICE...</span>
          ) : priceError ? (
            <span style={{ color: '#ff6b6b' }}> • PRICE ERROR</span>
          ) : mintPrice ? (
            <>
              {" • "}PRICE: <span style={{ fontFamily: 'monospace' }}>{formatEther(mintPrice)} APE</span>
              {" • "}TOTAL: <span style={{ fontFamily: 'monospace' }}>{formatEther(totalCostWei)} APE</span>
            </>
          ) : (
            <span style={{ color: '#ffa500' }}> • PRICE: 0.1 APE (fallback)</span>
          )}
        </div>

        {/* Mint Button */}
        <button
          disabled={!canMint || isMinting || isConfirming || !mintPrice}
          onClick={handleMint}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            background: canMint && !isMinting && !isConfirming && mintPrice
              ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)' 
              : 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
            color: '#c8ffc8',
            border: '2px solid #8a8a8a',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: canMint && !isMinting && !isConfirming && mintPrice ? 'pointer' : 'not-allowed',
            opacity: canMint && !isMinting && !isConfirming && mintPrice ? 1 : 0.5,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            marginBottom: '16px'
          }}
        >
          {isMinting ? "MINTING..." : isConfirming ? "CONFIRMING..." : "MINT CARTRIDGES"}
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
    </Stage>
  );
}
