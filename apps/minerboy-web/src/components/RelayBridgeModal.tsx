'use client';

import { useState, useMemo } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { parseEther, formatEther } from 'viem';

type RelayQuote = {
  steps: Array<{
    id: string;
    action: string;
    status: 'pending' | 'in-progress' | 'complete';
  }>;
  fees: {
    gas: string;
    relayer: string;
  };
  timeEstimate?: string;
};

type RelayBridgeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  suggestedAmount?: string; // In ETH/native token
};

export default function RelayBridgeModal({ isOpen, onClose, suggestedAmount = '0.01' }: RelayBridgeModalProps) {
  const { address } = useAccount();
  const fromChainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  const [amount, setAmount] = useState(suggestedAmount);
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Fetch Relay quote
  const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery({
    queryKey: ['relay-quote', fromChainId, amount, address],
    queryFn: async () => {
      if (!address) throw new Error('Wallet not connected');
      
      // Relay API endpoint (replace with actual Relay SDK when installed)
      const response = await fetch('https://api.relay.link/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: address,
          originChainId: fromChainId,
          destinationChainId: 33139, // ApeChain
          originCurrency: '0x0000000000000000000000000000000000000000', // Native token
          destinationCurrency: '0x0000000000000000000000000000000000000000', // Native APE
          amount: parseEther(amount).toString(),
          recipient: address,
          tradeType: 'EXACT_INPUT',
        }),
      });

      if (!response.ok) {
        throw new Error(`Relay API error: ${response.statusText}`);
      }

      return response.json() as Promise<RelayQuote>;
    },
    enabled: isOpen && !!address && parseFloat(amount) > 0,
    refetchInterval: 30000, // Refresh quote every 30s
  });

  const handleBridge = async () => {
    if (!quote || !walletClient || !address) {
      setError('Missing quote or wallet');
      return;
    }

    try {
      setIsBridging(true);
      setError('');
      setBridgeStatus('Preparing transaction...');

      // TODO: Replace with actual Relay SDK execution when installed
      // This is a placeholder showing the flow
      const response = await fetch('https://api.relay.link/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote,
          wallet: address,
        }),
      });

      if (!response.ok) {
        throw new Error('Bridge execution failed');
      }

      const { steps } = await response.json();

      // Track progress
      for (const step of steps) {
        setBridgeStatus(`${step.action}...`);
        // In real implementation, use Relay's onProgress callback
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setBridgeStatus('✅ Bridge complete! APE will arrive in ~30s');
      setTimeout(() => {
        onClose();
        setBridgeStatus('');
      }, 3000);

    } catch (err: any) {
      console.error('[RELAY_BRIDGE]', err);
      setError(err.message || 'Bridge failed');
    } finally {
      setIsBridging(false);
    }
  };

  const fromChainName = useMemo(() => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      8453: 'Base',
      42161: 'Arbitrum',
      10: 'Optimism',
      137: 'Polygon',
    };
    return chains[fromChainId] || `Chain ${fromChainId}`;
  }, [fromChainId]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 2000, // Higher than other modals
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0f2c1b',
        border: '2px solid #4a7d5f',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '2px solid #4a7d5f',
          background: 'linear-gradient(145deg, #1a4d2a, #2d5a3d)'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            color: '#c8ffc8',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            GET APE GAS
          </h2>
          <button
            onClick={onClose}
            disabled={isBridging}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c8ffc8',
              fontSize: '24px',
              cursor: isBridging ? 'not-allowed' : 'pointer',
              padding: '0 8px',
              opacity: isBridging ? 0.5 : 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          color: '#c8ffc8',
          maxHeight: 'calc(90vh - 140px)',
          overflowY: 'auto'
        }}>
          {/* Bridge Info */}
          <div style={{
            backgroundColor: '#1a4d2a',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid #4a7d5f'
          }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
              <strong>Bridge Route:</strong>
            </div>
            <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{fromChainName}</span>
              <span>→</span>
              <span style={{ color: '#ffd700' }}>ApeChain</span>
            </div>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Amount to Bridge:
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isBridging}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0a1f14',
                border: '1px solid #4a7d5f',
                borderRadius: '4px',
                color: '#c8ffc8',
                fontSize: '16px'
              }}
            />
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              Suggested: 0.01 ETH (≈ 50-100 claims worth of gas)
            </div>
          </div>

          {/* Quote Info */}
          {isLoadingQuote && (
            <div style={{
              backgroundColor: '#1a4d2a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              textAlign: 'center',
              fontSize: '14px'
            }}>
              Fetching quote...
            </div>
          )}

          {quote && !isLoadingQuote && (
            <div style={{
              backgroundColor: '#1a4d2a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #4a7d5f'
            }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>You'll receive:</strong> ~{formatEther(BigInt(quote.fees.gas))} APE
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>Time:</strong> {quote.timeEstimate || '~30 seconds'}
              </div>
              <div style={{ opacity: 0.7 }}>
                <strong>Fees:</strong> ~${quote.fees.relayer || 'calculating...'}
              </div>
            </div>
          )}

          {quoteError && (
            <div style={{
              backgroundColor: '#4a1a1a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #ff4444'
            }}>
              ⚠️ Quote failed: {(quoteError as Error).message}
            </div>
          )}

          {/* Bridge Status */}
          {bridgeStatus && (
            <div style={{
              backgroundColor: bridgeStatus.includes('✅') ? '#1a4d2a' : '#2a2a1a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #4a7d5f',
              textAlign: 'center'
            }}>
              {bridgeStatus}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: '#4a1a1a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              border: '1px solid #ff4444'
            }}>
              ❌ {error}
            </div>
          )}

          {/* Bridge Button */}
          <button
            onClick={handleBridge}
            disabled={isBridging || !quote || parseFloat(amount) <= 0}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isBridging || !quote ? '#2a3a2a' : '#4a7d5f',
              color: '#c8ffc8',
              border: '2px solid #6a9d7f',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isBridging || !quote ? 'not-allowed' : 'pointer',
              opacity: isBridging || !quote ? 0.6 : 1,
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}
          >
            {isBridging ? 'Bridging...' : `Bridge ${amount} to ApeChain`}
          </button>

          {/* Info Text */}
          <div style={{
            marginTop: '16px',
            fontSize: '12px',
            opacity: 0.7,
            textAlign: 'center'
          }}>
            Powered by <a href="https://relay.link" target="_blank" rel="noreferrer" style={{ color: '#ffd700', textDecoration: 'underline' }}>Relay</a>
          </div>
        </div>
      </div>
    </div>
  );
}

