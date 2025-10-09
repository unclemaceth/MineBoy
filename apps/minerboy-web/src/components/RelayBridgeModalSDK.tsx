'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apePublicClient } from '@/lib/apechain';
// @ts-expect-error - Install with: npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks
import { createClient } from '@relayprotocol/relay-sdk';
// @ts-expect-error - Install with: npm install @relayprotocol/relay-sdk @relayprotocol/relay-kit-hooks
import { useQuote } from '@relayprotocol/relay-kit-hooks';

const queryClient = new QueryClient();
const APECHAIN_ID = 33139;
const GAS_THRESHOLD = parseEther('0.005'); // ~25 claims worth

type Props = {
  isOpen: boolean;
  onClose: () => void;
  suggestedAmount?: string; // in native units (e.g., '0.01')
};

// init Relay client once per app (move to a provider if you like)
const relayClient = createClient({
  apiBase: 'https://api.relay.link', // or testnet: https://api.testnets.relay.link
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
  const { address } = useAccount();
  const fromChainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  // Debounced amount input
  const [rawAmount, setRawAmount] = useState(suggestedAmount);
  const [amount, setAmount] = useState(suggestedAmount);
  const [status, setStatus] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string>('');
  const [needsGas, setNeedsGas] = useState(false);
  const [apeGas, setApeGas] = useState<bigint | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string>('');
  const [isPollingGas, setIsPollingGas] = useState(false);

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

  // Validate and sanitize amount
  const validAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n >= 0.001 && n <= 5; // Min 0.001, max 5 ETH
  }, [amount]);

  // turn the human amount into wei (string)
  const weiAmount = useMemo(() => {
    try { return parseEther(amount).toString(); } catch { return '0'; }
  }, [amount]);

  // fetch a live quote
  const { data, isLoading, error, refetch } = useQuote({
    client: relayClient,
    options: {
      chainId: fromChainId,                // source chain
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
    if (data?.quote && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'relay_quote_loaded', {
        fromChainId,
        amount,
        timeEstimate: data.quote.timeEstimate,
      });
    }
  }, [data, fromChainId, amount]);

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
      if (!data?.quote) throw new Error('No quote');

      // Guard against stale quotes (user switched chains)
      if ((data.quote as any)?.from?.chainId && (data.quote as any).from.chainId !== fromChainId) {
        setErrMsg('Network changed. Refreshing quote…');
        await refetch();
        return;
      }

      // Analytics: Execute started
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'relay_execute_started', {
          fromChainId,
          amount,
          quoteId: (data.quote as any)?.id,
        });
      }

      // Execute via the hook-provided helper; progress mirrors SDK steps
      await data.executeQuote!((progress: any) => {
        const step = progress.currentStep;
        const detail = progress.details ?? '';
        setStatus(`${step}${detail ? `: ${detail}` : ''}`);
        
        // Analytics: Progress step
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'relay_progress_step', {
            fromChainId,
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
      }, { wallet: walletClient });

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
                fromChainId,
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
          fromChainId,
          amount,
          error: e?.message,
        });
      }
      
      setErrMsg(e?.message || 'Bridge failed');
      setStatus('');
      setIsPollingGas(false);
    }
  };

  const fromChainName = useMemo(() => {
    const map: Record<number, string> = {
      1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism', 137: 'Polygon'
    };
    return map[fromChainId] || `Chain ${fromChainId}`;
  }, [fromChainId]);

  // deep-link fallback
  const deeplink = useMemo(() => {
    const u = new URL('https://relay.link/bridge/apechain');
    u.searchParams.set('fromChainId', String(fromChainId));
    if (address) u.searchParams.set('toAddress', address);
    return u.toString();
  }, [fromChainId, address]);

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

          {/* route */}
          {address && (
            <div style={card}>
              <div style={{ fontSize: 14, marginBottom: 8 }}><strong>Bridge Route</strong></div>
              <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{fromChainName}</span><span>→</span><span style={{ color: '#ffd700' }}>ApeChain (33139)</span>
              </div>
              {apeGas !== null && (
                <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                  ApeChain balance: {formatEther(apeGas)} APE {needsGas ? '(low ⚠️)' : '✓'}
                </div>
              )}
              
              {/* Base-first hint + switch CTA */}
              {fromChainId === 1 && (
                <div style={{ marginTop: 8, padding: 8, background: '#4a3a1a', borderRadius: 4, border: '1px solid #ffd700' }}>
                  <div style={{ fontSize: 11, color: '#ffd700', marginBottom: 6 }}>
                    💡 Switch to Base for 75% cheaper fees ($0.50 vs $2.00)
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        if (walletClient?.switchChain) {
                          await walletClient.switchChain({ id: 8453 });
                        } else if ((window as any).ethereum) {
                          await (window as any).ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x2105' }], // 8453 in hex
                          });
                        }
                      } catch (e) {
                        console.error('Switch chain failed:', e);
                      }
                    }}
                    disabled={isPollingGas}
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: '#1a4d2a',
                      border: '1px solid #4a7d5f',
                      borderRadius: 4,
                      color: '#c8ffc8',
                      fontSize: 12,
                      cursor: isPollingGas ? 'not-allowed' : 'pointer',
                      opacity: isPollingGas ? 0.6 : 1
                    }}
                  >
                    Switch to Base Network
                  </button>
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
                Min: 0.001, Max: 5.0 {!validAmount && rawAmount && '(invalid amount)'}
              </div>
              
              {/* One-tap presets */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {['0.005', '0.01', '0.02'].map(amt => (
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

          {address && data?.quote && !isLoading && (
            <div style={card}>
              <div><strong>Time:</strong> {data.quote.timeEstimate ?? '~30–60s'}</div>
              <div><strong>Relayer covers dst gas:</strong> yes</div>
              {/* show out amount when present */}
              {data.quote?.to?.amount && (
                <div><strong>Est. receive:</strong> ~{formatEther(BigInt(data.quote.to.amount))} APE</div>
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
              disabled={!data?.quote || isLoading || !validAmount || isPollingGas}
              style={{
                ...btn,
                backgroundColor: (!data?.quote || isLoading || !validAmount || isPollingGas) ? '#2a3a2a' : '#4a7d5f',
                cursor: (!data?.quote || isLoading || !validAmount || isPollingGas) ? 'not-allowed' : 'pointer',
                opacity: (!data?.quote || isLoading || !validAmount || isPollingGas) ? 0.6 : 1
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

