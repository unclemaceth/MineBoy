'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
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
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const walletClient = useActiveWalletClient();
  
  // Selected source chain (default to Base)
  const [selectedFromChainId, setSelectedFromChainId] = useState(8453); // Base
  const [sourceBalance, setSourceBalance] = useState<bigint | null>(null);
  const [justSwitched, setJustSwitched] = useState(false); // Track if we just successfully switched
  
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

  // fetch a live quote
  const { data, isLoading, error, refetch } = (useQuote as any)({
    client: relayClient,
    options: {
      chainId: selectedFromChainId,        // source chain (user-selected)
      toChainId: APECHAIN_ID,              // ApeChain
      currency: '0x0000000000000000000000000000000000000000', // native in
      toCurrency: '0x0000000000000000000000000000000000000000', // native APE out
      amount: weiAmount,
      user: address!,                      // payer/sender on source
      recipient: address!,                 // receiver on ApeChain
      tradeType: 'EXACT_INPUT',
    },
    enabled: Boolean(address && parseFloat(amount) > 0),
    refetchInterval: 30_000,
  });

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
      
      if (!walletClient) throw new Error('Wallet not connected');
      if (!data) throw new Error('No quote');

      // Guard against stale quotes (user switched chains)
      if ((data as any)?.from?.chainId && (data as any).from.chainId !== selectedFromChainId) {
        setErrMsg('Chain changed. Refreshing quote…');
        await refetch();
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
        
        // Show explorer links from progress
        if (progress.txHashes?.length) {
          const last = progress.txHashes[progress.txHashes.length - 1];
          if (last?.hash) {
            setLastTxUrl(`https://apescan.io/tx/${last.hash}`);
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
                      if (!switchChain) {
                        console.error('[RelayBridge] switchChain is not available');
                        setErrMsg('Chain switching not available. Please switch manually in your wallet.');
                        return;
                      }
                      try {
                        setStatus(`Requesting switch to ${selectedChain.name}...`);
                        setErrMsg('');
                        console.log('[RelayBridge] Calling switchChain with chainId:', selectedFromChainId);
                        await switchChain({ chainId: selectedFromChainId });
                        console.log('[RelayBridge] Switch successful');
                        setJustSwitched(true); // Hide the warning immediately
                        setStatus(`✓ Switched to ${selectedChain.name}!`);
                        setTimeout(() => setStatus(''), 2000);
                      } catch (err: any) {
                        console.error('[RelayBridge] Failed to switch chain:', err);
                        setErrMsg(err?.message || 'Failed to switch chain. Please switch manually in your wallet.');
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
              ⚠️ {String((error as any)?.message || error)}
              {String((error as any)?.message || '').includes('unsupported') && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Use the fallback link below to bridge manually.
                </div>
              )}
            </div>
          )}

          {address && data && !isLoading && (
            <div style={card}>
              <div><strong>Time:</strong> {(data as any).timeEstimate ?? '~30–60s'}</div>
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

          {/* actions */}
          {address && (
            <button
              onClick={execute}
              disabled={!data || isLoading || !validAmount || isPollingGas}
              style={{
                ...btn,
                backgroundColor: (!data || isLoading || !validAmount || isPollingGas) ? '#2a3a2a' : '#4a7d5f',
                cursor: (!data || isLoading || !validAmount || isPollingGas) ? 'not-allowed' : 'pointer',
                opacity: (!data || isLoading || !validAmount || isPollingGas) ? 0.6 : 1
              }}
            >
              {isPollingGas ? 'Waiting for APE...' : isLoading ? 'Preparing…' : `Bridge ${amount} to ApeChain`}
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

