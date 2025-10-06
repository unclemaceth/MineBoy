'use client';

import { useState } from 'react';
import { buildFill, confirmFill } from '@/lib/market';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveWalletClient } from '@/hooks/useActiveWalletClient';

type BuyButtonProps = {
  tokenId: string;
  priceLabel: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

export function BuyButton({ tokenId, priceLabel, onSuccess, onError }: BuyButtonProps) {
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  
  const { address } = useActiveAccount();
  const walletClient = useActiveWalletClient();

  async function handleBuy() {
    if (!address || !walletClient) {
      onError?.('Please connect your wallet first');
      return;
    }

    try {
      setBusy(true);
      setTxHash(null);

      // 1. Get transaction data from backend
      console.log('[Buy] Building fill for token', tokenId);
      const fillData = await buildFill(tokenId, address);

      // 2. Ensure correct chain (33139 = ApeChain)
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== fillData.chainId) {
        // Request chain switch
        try {
          await walletClient.switchChain({ id: fillData.chainId });
        } catch (switchErr) {
          throw new Error(`Please switch to ApeChain (Chain ID ${fillData.chainId})`);
        }
      }

      // 3. Send transaction
      console.log('[Buy] Sending transaction...', {
        to: fillData.to,
        value: fillData.value,
        chainId: fillData.chainId
      });

      const hash = await walletClient.sendTransaction({
        to: fillData.to as `0x${string}`,
        data: fillData.data as `0x${string}`,
        value: BigInt(fillData.value),
        account: address as `0x${string}`,
        chain: {
          id: fillData.chainId,
          name: 'ApeChain',
          nativeCurrency: { name: 'APE', symbol: 'APE', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://rpc.apechain.com/http'] },
            public: { http: ['https://rpc.apechain.com/http'] }
          }
        }
      });

      setTxHash(hash);
      console.log('[Buy] Transaction sent:', hash);

      // 4. Confirm to backend (triggers flywheel)
      console.log('[Buy] Confirming purchase...');
      await confirmFill({
        tokenId,
        txHash: hash,
        buyer: address
      });

      setDone(true);
      console.log('[Buy] Purchase complete!');
      onSuccess?.();

    } catch (err: any) {
      console.error('[Buy] Error:', err);
      const message = err.message || String(err);
      onError?.(message);
      
      // Show user-friendly error
      if (message.includes('sold')) {
        onError?.('This NPC was just sold!');
      } else if (message.includes('not-listed')) {
        onError?.('This NPC is no longer available');
      } else if (message.includes('User rejected')) {
        onError?.('Transaction cancelled');
      } else {
        onError?.(message);
      }
    } finally {
      setBusy(false);
    }
  }

  // Button states
  if (done) {
    return (
      <button
        className="px-4 py-2 rounded-md shadow disabled:opacity-50"
        disabled
        style={{
          backgroundColor: '#1a4d2a',
          border: '2px solid #2d5a3d',
          color: '#c8ffc8',
          cursor: 'not-allowed',
          fontWeight: 'bold',
          fontSize: '13px'
        }}
        title="Purchase complete!"
      >
        Purchased ✓
      </button>
    );
  }

  return (
    <button
      onClick={handleBuy}
      disabled={busy || !address}
      style={{
        backgroundColor: busy || !address ? '#444' : '#ffd700',
        color: busy || !address ? '#888' : '#000',
        border: 'none',
        borderRadius: '4px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 'bold',
        cursor: busy || !address ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.2s',
        opacity: busy || !address ? 0.5 : 1,
        minWidth: '120px'
      }}
      onMouseEnter={(e) => {
        if (!busy && address) {
          e.currentTarget.style.opacity = '0.8';
        }
      }}
      onMouseLeave={(e) => {
        if (!busy && address) {
          e.currentTarget.style.opacity = '1';
        }
      }}
      title={
        !address 
          ? 'Connect wallet to buy'
          : busy 
            ? 'Processing transaction...'
            : `Buy for ${priceLabel}`
      }
    >
      {busy ? (
        <>
          {txHash ? 'Confirming...' : 'Buying...'}
        </>
      ) : (
        <>Buy for {priceLabel}</>
      )}
    </button>
  );
}
