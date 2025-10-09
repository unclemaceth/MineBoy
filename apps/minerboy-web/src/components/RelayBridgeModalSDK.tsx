'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { formatEther, parseEther, createPublicClient, http } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apePublicClient } from '@/lib/apechain';
import { createClient } from '@relayprotocol/relay-sdk';
import { useQuote } from '@relayprotocol/relay-kit-hooks';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveWalletClient } from '@/hooks/useActiveWalletClient';
import { mainnet, base, arbitrum, optimism, polygon } from 'viem/chains';

const queryClient = new QueryClient();
const APECHAIN_ID = 33139;
const GAS_THRESHOLD = parseEther('0.005'); // ~25 claims worth

// Supported source chains for bridging
const BRIDGE_CHAINS = [
  { id: 8453, name: 'Base', symbol: 'ETH', chain: base },
  { id: 1, name: 'Ethereum', symbol: 'ETH', chain: mainnet },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH', chain: arbitrum },
  { id: 10, name: 'Optimism', symbol: 'ETH', chain: optimism },
  { id: 137, name: 'Polygon', symbol: 'MATIC', chain: polygon },
];

// Explorer URLs for transaction links
const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  42161: 'https://arbiscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  33139: 'https://apescan.io/tx/',
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  suggestedAmount?: string; // in native units (e.g., '0.01')
};

// init Relay client once per app  
const relayClient = createClient({
  baseApiUrl: 'https://api.relay.link',
  source: 'mineboy.app',
});

export default function RelayBridgeModalSDK({ isOpen, onClose, suggestedAmount = '0.01' }: Props) {
  if (!isOpen) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <BridgeInner onClose={onClose} suggestedAmount={suggestedAmount} />
    </QueryClientProvider>
  );
}

function BridgeInner({ onClose, suggestedAmount }: { onClose: () => void; suggestedAmount: string }) {
  const { address, isConnected } = useActiveAccount();
  const wagmiChainId = useChainId();
  const walletClient = useActiveWalletClient();
  
  // Track ACTUAL chain ID by polling the provider directly
  const [realChainId, setRealChainId] = useState<number | null>(null);
  
  // Get the ACTUAL current chain ID from the wallet client, or our polled value
  const currentChainId = realChainId ?? walletClient?.chain?.id ?? wagmiChainId;
  
  // Selected source chain (default to Base)
  const [selectedFromChainId, setSelectedFromChainId] = useState(8453); // Base
  const [sourceBalance, setSourceBalance] = useState<bigint | null>(null);
  const [justSwitched, setJustSwitched] = useState(false); // Track if we just successfully switched
  
  // Poll for ACTUAL chain ID directly from provider
  useEffect(() => {
    console.log('[RelayBridge] Polling effect running, walletClient:', !!walletClient);
    
    const pollChainId = async () => {
      if (!walletClient) {
        console.log('[RelayBridge] No walletClient available for polling');
        return;
      }
      try {
        const chainIdHex = await walletClient.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex as string, 16);
        console.log('[RelayBridge] Direct eth_chainId query:', chainId);
        setRealChainId(chainId);
      } catch (err) {
        console.error('[RelayBridge] Failed to query chain ID:', err);
      }
    };
    
    pollChainId();
    const interval = setInterval(pollChainId, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [walletClient]);
  
  // Debounced amount input
  const [rawAmount, setRawAmount] = useState(suggestedAmount);
  const [amount, setAmount] = useState(suggestedAmount);
  const [status, setStatus] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string>('');
  const [needsGas, setNeedsGas] = useState(false);
  const [apeGas, setApeGas] = useState<bigint | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string>('');
  const [isPollingGas, setIsPollingGas] = useState(false);
  
  const selectedChain = BRIDGE_CHAINS.find(c => c.id === selectedFromChainId) || BRIDGE_CHAINS[0];

  // Debounce amount input (avoid thrashing quotes)
  useEffect(() => {
    const t = setTimeout(() => setAmount(rawAmount || '0'), 350);
    return () => clearTimeout(t);
  }, [rawAmount]);

  // Check ApeChain gas balance (always query ApeChain RPC)
  useEffect(() => {
    (async () => {
      try {
        if (!address) return;
        const v = await apePublicClient.getBalance({ address });
        setApeGas(v);
        setNeedsGas(v < GAS_THRESHOLD);
      } catch {
        // ignore
      }
    })();
  }, [address]);

  // Fetch balance on selected source chain
  useEffect(() => {
    (async () => {
      try {
        if (!address) return;
        const client = createPublicClient({
          chain: selectedChain.chain,
          transport: http()
        });
        const bal = await client.getBalance({ address });
        setSourceBalance(bal);
      } catch (err) {
        console.warn('Failed to fetch source balance:', err);
        setSourceBalance(null);
      }
    })();
  }, [address, selectedFromChainId, selectedChain.chain]);

  // Validate and sanitize amount
  const validAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n >= 0.0005 && n <= 5; // Min 0.0005, max 5 ETH
  }, [amount]);

  // turn the human amount into wei (string)
  const weiAmount = useMemo(() => {
    try { return parseEther(amount).toString(); } catch { return '0'; }
  }, [amount]);

  // Constants for Relay
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  // Log quote request params (dev only to reduce noise)
  if (process.env.NODE_ENV === 'development') {
    console.log('[RelayBridge] Quote request params:');
    console.log('  originChainId (from):', selectedFromChainId);
    console.log('  destinationChainId (to):', APECHAIN_ID);
    console.log('  originCurrency:', ZERO_ADDRESS);
    console.log('  destinationCurrency:', ZERO_ADDRESS);
    console.log('  amount (wei):', weiAmount);
    console.log('  amount (human):', amount);
    console.log('  user:', address);
    console.log('  recipient:', address);
    console.log('  tradeType:', 'EXACT_INPUT');
    console.log('  enabled:', Boolean(address && parseFloat(amount) > 0));
  }

  // fetch a live quote - useQuote expects POSITIONAL args, not a single object!
  const { data, isLoading, error, refetch, executeQuote } = (useQuote as any)(
    relayClient,                           // arg 1: client
    undefined,                             // arg 2: wallet (undefined during quote, pass during execute only)
    {                                      // arg 3: options (API schema with origin/destination fields)
      user: address!,
      recipient: address!,
      originChainId: selectedFromChainId,  // e.g., Base 8453
      destinationChainId: APECHAIN_ID,     // ApeChain 33139
      originCurrency: ZERO_ADDRESS,        // native ETH
      destinationCurrency: ZERO_ADDRESS,   // native APE
      tradeType: 'EXACT_INPUT',
      amount: weiAmount,                   // wei string
    },
    undefined,                             // arg 4: chain config (optional)
    undefined,                             // arg 5: fetch options (optional)
    {                                      // arg 6: React Query options
      enabled: Boolean(address && parseFloat(amount) > 0), // Allow quotes even if on different chain
      refetchInterval: 30_000,
    }
  );

  // Log quote state for debugging
  useEffect(() => {
    console.log('[RelayBridge] Quote state:');
    console.log('  - isLoading:', isLoading);
    console.log('  - hasData:', !!data);
    console.log('  - hasError:', !!error);
    if (data) {
      console.log('  - Quote data (raw):', data);
      try {
        console.log('  - Quote data (JSON):', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('  - Quote data (could not stringify, circular ref?)');
      }
      console.log('  - timeEstimate type:', typeof (data as any).timeEstimate);
      console.log('  - timeEstimate value:', (data as any).timeEstimate);
    }
    console.log('  - amount:', amount);
    console.log('  - validAmount:', validAmount);
    console.log('  - selectedFromChainId:', selectedFromChainId);
    console.log('  - wagmiChainId:', wagmiChainId);
    console.log('  - walletClient.chain.id:', walletClient?.chain?.id);
    console.log('  - realChainId (polled from provider):', realChainId);
    console.log('  - currentChainId (final):', currentChainId);
    console.log('  - ON CORRECT CHAIN?:', currentChainId === selectedFromChainId);
    console.log('  - address:', address);
    console.log('  - Bridge button disabled because:', {
      noData: !data,
      loading: isLoading,
      invalidAmount: !validAmount,
      polling: isPollingGas,
      wrongChain: currentChainId !== selectedFromChainId,
      noWalletClient: !walletClient,
    });
    if (error) {
      const body = (error as any)?.response?.data;
      console.error('  - ERROR FULL:', error);
      console.error('  - ERROR MESSAGE:', (error as any)?.message);
      console.error('  - ERROR RESPONSE:', (error as any)?.response);
      console.error('  - ERROR RESPONSE.data (BODY):', body);
      console.error('  - ERROR RESPONSE.status:', (error as any)?.response?.status);
      console.error('  - ERROR RESPONSE.statusText:', (error as any)?.response?.statusText);
      console.error('  - ERROR DATA:', (error as any)?.data);
      
      // Try to extract meaningful error message
      const errorMsg = body?.message || body?.error || (error as any)?.message || 'Quote failed';
      console.error('  - PARSED ERROR MESSAGE:', errorMsg);
      
      // If it's a serialization issue, try stringifying
      if (body && typeof body === 'object') {
        try {
          console.error('  - ERROR BODY as JSON:', JSON.stringify(body, null, 2));
        } catch {
          console.error('  - ERROR BODY (could not stringify)');
        }
      }
    }
  }, [data, isLoading, error, amount, validAmount, selectedFromChainId, currentChainId, realChainId, wagmiChainId, walletClient, address, isPollingGas]);

  // Analytics: Quote loaded
  useEffect(() => {
    if (data && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'relay_quote_loaded', {
        fromChainId: selectedFromChainId,
        amount,
        timeEstimate: (data as any).timeEstimate,
      });
    }
  }, [data, selectedFromChainId, amount]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      setIsPollingGas(false); // Clear polling flag on unmount
    };
  }, []);

  const execute = async () => {
    try {
      setErrMsg('');
      setStatus('Preparing…');
      setLastTxUrl('');
      
      if (!walletClient) {
        setErrMsg('Wallet not connected. Please reconnect and try again.');
        setStatus('');
        return;
      }
      if (!data) {
        setErrMsg('No quote available. Please wait for quote to load.');
        setStatus('');
        return;
      }

      // Guard against stale quotes (user switched chains after quote was fetched)
      const quoteOriginChain = (data as any)?.from?.chainId || (data as any)?.originChainId;
      if (quoteOriginChain && quoteOriginChain !== selectedFromChainId) {
        console.warn('[RelayBridge] Quote is stale - chain changed from', quoteOriginChain, 'to', selectedFromChainId);
        setErrMsg('Network changed. Refreshing quote…');
        await refetch();
        return;
      }
      
      // Also verify wallet is on correct chain
      if (currentChainId !== selectedFromChainId) {
        setErrMsg(`Please switch to ${selectedChain.name} to continue`);
        return;
      }

      // Analytics: Execute started
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'relay_execute_started', {
          fromChainId: selectedFromChainId,
          amount,
          quoteId: (data as any)?.id,
        });
      }

      // Execute via SDK; progress mirrors SDK steps
      await relayClient.actions.execute({
        quote: data as any, // Type cast for SDK compatibility
        wallet: walletClient as any,
        onProgress: (progress: any) => {
        const step = progress.currentStep;
        const detail = progress.details ?? '';
        setStatus(`${step}${detail ? `: ${detail}` : ''}`);
        
        // Analytics: Progress step
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'relay_progress_step', {
            fromChainId: selectedFromChainId,
            amount,
            step,
          });
        }
        
        // Show explorer links from progress (use correct explorer based on chain)
        if (progress.txHashes?.length) {
          const last = progress.txHashes[progress.txHashes.length - 1];
          if (last?.hash) {
            const explorerBase = EXPLORERS[last.chainId ?? APECHAIN_ID] ?? EXPLORERS[APECHAIN_ID];
            setLastTxUrl(`${explorerBase}${last.hash}`);
          }
        }
        },
      });

      setStatus('✅ Bridge complete! Waiting for APE on ApeChain…');
      
      // Auto-close when gas lands (poll ApeChain balance)
      setIsPollingGas(true);
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        try {
          if (!address) return;
          const v = await apePublicClient.getBalance({ address });
          setApeGas(v);
          
          if (v >= GAS_THRESHOLD || tries > 24) { // ~2 min @ 5s intervals
            clearInterval(iv);
            setIsPollingGas(false);
            setStatus('✅ APE received! You can now claim.');
            
            // Analytics: Bridge complete
            if (typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'relay_execute_complete', {
                fromChainId: selectedFromChainId,
                amount,
                finalBalance: Number(v),
              });
            }
            
            // Optional: Auto-retry claim if handler provided
            if ((window as any).__mineboyAutoRetry) {
              setTimeout(async () => {
                try {
                  await (window as any).__mineboyAutoRetry();
                  onClose();
                } catch (retryErr) {
                  setStatus('✅ APE received! Tap Claim to continue.');
                }
              }, 1000);
            } else {
              setTimeout(() => {
                onClose();
                setStatus('');
                setLastTxUrl('');
              }, 2000);
            }
          }
        } catch {
          // ignore polling errors
        }
      }, 5000);
      
    } catch (e: any) {
      // Analytics: Bridge error
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'relay_execute_error', {
          fromChainId: selectedFromChainId,
          amount,
          error: e?.message,
        });
      }
      
      setErrMsg(e?.message || 'Bridge failed');
      setStatus('');
      setIsPollingGas(false);
    }
  };

  // deep-link fallback
  const deeplink = useMemo(() => {
    const u = new URL('https://relay.link/bridge/apechain');
    u.searchParams.set('fromChainId', String(selectedFromChainId));
    if (address) u.searchParams.set('toAddress', address);
    return u.toString();
  }, [selectedFromChainId, address]);
  
  const needsChainSwitch = currentChainId !== selectedFromChainId && !justSwitched;
  
  // Clear condition for when bridge button should be enabled
  const canExecute =
    !!data &&
    !isLoading &&
    validAmount &&
    !isPollingGas &&
    !!walletClient &&
    currentChainId === selectedFromChainId;
  
  // Clear justSwitched flag when chain actually updates
  useEffect(() => {
    if (currentChainId === selectedFromChainId && justSwitched) {
      setJustSwitched(false);
    }
  }, [currentChainId, selectedFromChainId, justSwitched]);
  
  // Clear justSwitched when user selects a different chain
  useEffect(() => {
    setJustSwitched(false);
  }, [selectedFromChainId]);
  
  // Optional: Force refetch quote when chain becomes correct (for freshness)
  useEffect(() => {
    if (currentChainId === selectedFromChainId && address && parseFloat(amount) > 0 && !isLoading) {
      console.log('[RelayBridge] Chain is now correct, triggering quote refetch for freshness...');
      refetch();
    }
  }, [currentChainId, selectedFromChainId, address, amount, isLoading, refetch]);

  return (
    <div style={backdrop}>
      <div style={modal}>
        {/* header */}
        <div style={header}>
          <h2 style={title}>⛽ GET APE GAS</h2>
          <button onClick={onClose} disabled={isPollingGas} style={{...closeBtn, cursor: isPollingGas ? 'not-allowed' : 'pointer', opacity: isPollingGas ? 0.5 : 1}}>×</button>
        </div>

        {/* body */}
        <div style={body}>
          {/* Empty state: wallet not connected */}
          {!address && (
            <div style={{...card, background: '#4a3a1a', border: '1px solid #ffd700'}}>
              ⚠️ <strong>Connect wallet</strong> to bridge gas to ApeChain
            </div>
          )}

          {/* Chain Selector */}
          {address && (
            <div style={card}>
              <div style={{ fontSize: 14, marginBottom: 8 }}><strong>From (Source Chain)</strong></div>
              <select
                value={selectedFromChainId}
                onChange={(e) => setSelectedFromChainId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a1f14',
                  border: '1px solid #4a7d5f',
                  borderRadius: '4px',
                  color: '#c8ffc8',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {BRIDGE_CHAINS.map(chain => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} ({chain.symbol})
                  </option>
                ))}
              </select>
              
              {/* Source chain balance */}
              {sourceBalance !== null && (
                <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                  {selectedChain.name} balance: {formatEther(sourceBalance)} {selectedChain.symbol}
                </div>
              )}
              
              {/* Chain switch warning */}
              {needsChainSwitch && (
                <div style={{ marginTop: 8, padding: 8, background: '#4a3a1a', borderRadius: 4, border: '1px solid #ffd700' }}>
                  <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 6 }}>
                    ⚠️ Please switch your wallet to {selectedChain.name}
                  </div>
                  <button
                    onClick={async () => {
                      console.log('[RelayBridge] Switch chain clicked:', selectedFromChainId, selectedChain.name);
                      if (!walletClient) {
                        console.error('[RelayBridge] walletClient is not available');
                        setErrMsg('Wallet not connected. Please connect your wallet.');
                        return;
                      }
                      
                      // Timeout to clear stuck status
                      const statusTimeout = setTimeout(() => {
                        setStatus('');
                        console.log('[RelayBridge] Switch request timed out or was cancelled');
                      }, 10000); // Clear after 10 seconds
                      
                      try {
                        setStatus(`Requesting switch to ${selectedChain.name}...`);
                        setErrMsg('');
                        console.log('[RelayBridge] Using wallet client to switch chain to:', selectedFromChainId);
                        
                        // Use the wallet client directly to request chain switch
                        await walletClient.request({
                          method: 'wallet_switchEthereumChain',
                          params: [{ chainId: `0x${selectedFromChainId.toString(16)}` }],
                        });
                        
                        clearTimeout(statusTimeout);
                        console.log('[RelayBridge] Switch successful');
                        setJustSwitched(true); // Hide the warning immediately
                        setStatus(`✓ Switched to ${selectedChain.name}!`);
                        setTimeout(() => setStatus(''), 2000);
                      } catch (err: any) {
                        clearTimeout(statusTimeout);
                        console.error('[RelayBridge] Failed to switch chain:', err);
                        
                        // Check if user rejected
                        const isRejection = err?.message?.toLowerCase()?.includes('reject') || 
                                          err?.message?.toLowerCase()?.includes('denied') ||
                                          err?.message?.toLowerCase()?.includes('cancel');
                        
                        if (isRejection) {
                          setErrMsg('Chain switch cancelled. Please switch manually in your wallet.');
                        } else {
                          setErrMsg(err?.message || 'Failed to switch chain. Please switch manually in your wallet.');
                        }
                        setStatus('');
                      }
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                      e.currentTarget.style.opacity = '0.8';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'linear-gradient(145deg, #ffd700, #cc9900)',
                      color: '#0a1f14',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    Switch to {selectedChain.name}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Destination (ApeChain) */}
          {address && (
            <div style={card}>
              <div style={{ fontSize: 14, marginBottom: 8 }}><strong>To (Destination)</strong></div>
              <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#ffd700' }}>ApeChain (APE)</span>
              </div>
              {apeGas !== null && (
                <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                  Current balance: {formatEther(apeGas)} APE {needsGas ? '(low ⚠️)' : '✓'}
                </div>
              )}
            </div>
          )}

          {/* amount */}
          {address && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Amount to bridge</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                disabled={isPollingGas}
                style={{...input, opacity: isPollingGas ? 0.6 : 1}}
              />
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
                Min: 0.0005, Max: 5.0 {!validAmount && rawAmount && '(invalid amount)'}
              </div>
              
              {/* One-tap presets */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {['0.0005', '0.005', '0.01'].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRawAmount(amt)}
                    disabled={isPollingGas}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: rawAmount === amt ? '#4a7d5f' : '#1a4d2a',
                      border: '1px solid #4a7d5f',
                      borderRadius: 4,
                      color: '#c8ffc8',
                      fontSize: 12,
                      cursor: isPollingGas ? 'not-allowed' : 'pointer',
                      opacity: isPollingGas ? 0.6 : 1
                    }}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* quote */}
          {address && isLoading && <div style={pill}>Fetching quote…</div>}
          
          {/* Better error states */}
          {address && error && (
            <div style={errorBox}>
              ⚠️ {(() => {
                const body = (error as any)?.response?.data;
                const errorMsg = body?.message || body?.error || (error as any)?.message || 'Quote failed';
                return String(errorMsg);
              })()}
              {String((error as any)?.message || '').includes('unsupported') && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Use the fallback link below to bridge manually.
                </div>
              )}
            </div>
          )}

          {address && data && !isLoading && (
            <div style={card}>
              <div><strong>Time:</strong> {(() => {
                const timeEst = (data as any).timeEstimate;
                if (!timeEst) return '~30–60s';
                if (typeof timeEst === 'string') return timeEst;
                if (typeof timeEst === 'object' && timeEst.display) return timeEst.display;
                return '~30–60s';
              })()}</div>
              <div><strong>Relayer covers dst gas:</strong> yes</div>
              {/* show out amount when present */}
              {(data as any)?.to?.amount && (
                <div><strong>Est. receive:</strong> ~{formatEther(BigInt((data as any).to.amount))} APE</div>
              )}
            </div>
          )}

          {/* status / errors */}
          {status && (
            <div style={statusBox}>
              {status}
              {lastTxUrl && (
                <div style={{ marginTop: 8 }}>
                  <a href={lastTxUrl} target="_blank" rel="noreferrer" style={{ color: '#ffd700', textDecoration: 'underline', fontSize: 12 }}>
                    View on Explorer →
                  </a>
                </div>
              )}
            </div>
          )}
          {errMsg && <div style={errorBox}>❌ {errMsg}</div>}
          {isLoading && !data && <div style={{ marginTop: 12, fontSize: 12, color: '#ffd700', textAlign: 'center' }}>⏳ Fetching quote from Relay...</div>}

          {/* actions */}
          {address && (
            <button
              onClick={execute}
              disabled={!canExecute}
              style={{
                ...btn,
                backgroundColor: canExecute ? '#4a7d5f' : '#2a3a2a',
                cursor: canExecute ? 'pointer' : 'not-allowed',
                opacity: canExecute ? 1 : 0.6
              }}
            >
              {!canExecute && currentChainId !== selectedFromChainId
                ? `Switch to ${selectedChain.name} to bridge`
                : isLoading
                ? 'Preparing…'
                : isPollingGas
                ? 'Waiting for APE...'
                : `Bridge ${amount} to ApeChain`}
            </button>
          )}

          {/* fallback */}
          <a href={deeplink} target="_blank" rel="noreferrer" style={{ ...btn, marginTop: 12, textAlign: 'center', textDecoration: 'none' }}>
            Open Relay.link in a new tab →
          </a>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
            Powered by <a href="https://docs.relay.link" target="_blank" rel="noreferrer" style={{ color: '#ffd700', textDecoration: 'underline' }}>Relay</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* styles */
const backdrop: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 };
const modal: React.CSSProperties = { background:'#0f2c1b', border:'2px solid #4a7d5f', borderRadius:8, width:'100%', maxWidth:420, maxHeight:'90vh', overflow:'hidden' };
const header: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'2px solid #4a7d5f', background:'linear-gradient(145deg,#1a4d2a,#2d5a3d)' };
const title: React.CSSProperties = { margin:0, fontSize:18, color:'#c8ffc8', fontWeight:'bold', textShadow:'2px 2px 4px rgba(0,0,0,0.8)' };
const closeBtn: React.CSSProperties = { background:'transparent', border:'none', color:'#c8ffc8', fontSize:24, cursor:'pointer', padding:'0 8px' };
const body: React.CSSProperties = { padding:20, color:'#c8ffc8', maxHeight:'calc(90vh - 140px)', overflowY:'auto' };
const card: React.CSSProperties = { background:'#1a4d2a', padding:12, borderRadius:6, marginBottom:16, border:'1px solid #4a7d5f', fontSize:13 };
const input: React.CSSProperties = { width:'100%', padding:10, background:'#0a1f14', border:'1px solid #4a7d5f', borderRadius:4, color:'#c8ffc8', fontSize:16 };
const pill: React.CSSProperties = { background:'#1a4d2a', padding:12, borderRadius:6, marginBottom:16, textAlign:'center', fontSize:14 };
const statusBox: React.CSSProperties = { background:'#1a4d2a', padding:12, borderRadius:6, marginBottom:16, fontSize:13, border:'1px solid #4a7d5f', textAlign:'center' };
const errorBox: React.CSSProperties = { background:'#4a1a1a', padding:12, borderRadius:6, marginBottom:16, fontSize:13, border:'1px solid #ff4444' };
const btn: React.CSSProperties = { display:'block', width:'100%', padding:14, color:'#c8ffc8', border:'2px solid #6a9d7f', borderRadius:6, fontSize:16, fontWeight:'bold', textShadow:'1px 1px 2px rgba(0,0,0,0.5)', background:'#4a7d5f' };

