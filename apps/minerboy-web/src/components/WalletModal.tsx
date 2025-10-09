'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChainId, useReadContract } from 'wagmi';
import { formatEther, parseEther, isAddress } from 'viem';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { apePublicClient, apechain } from '@/lib/apechain';
import { formatAddress, copyToClipboard } from '@/lib/format';
import { lookupArcadeName, detectRecipientType, isValidArcadeName, type ArcadeUser } from '@/lib/arcadeLookup';
import { useSendAPE } from '@/hooks/useSendAPE';
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';
import { playButtonSound } from '@/lib/sounds';
import { thirdwebClient } from '@/app/ThirdwebProvider';
import { defineChain } from 'thirdweb/chains';
import { PayEmbed } from 'thirdweb/react';

const APECHAIN_ID = 33139;
const MNESTR_TOKEN_ADDRESS = '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276' as const;

// Define ApeChain for Thirdweb
const thirdwebApechain = defineChain({
  id: 33139,
  name: 'ApeChain',
  rpc: 'https://rpc.apechain.com',
  nativeCurrency: {
    name: 'ApeCoin',
    symbol: 'APE',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'ApeScan',
      url: 'https://apescan.io',
    },
  ],
});

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function WalletModal({ isOpen, onClose }: Props) {
  const { address, isConnected, provider } = useActiveAccount();
  const chainId = useChainId();
  
  const [apeBalance, setApeBalance] = useState<bigint | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCheckout, setShowCheckout] = useState<'5' | '10' | '25' | null>(null);

  // Detect if using Glyph (embedded wallet)
  const isGlyph = useMemo(() => {
    return provider === 'glyph';
  }, [provider]);

  // Fetch MNESTR balance
  const { data: mnestrBalanceRaw } = useReadContract({
    address: MNESTR_TOKEN_ADDRESS,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isOpen,
    },
  });

  const mnestrBalance = mnestrBalanceRaw ? Number(mnestrBalanceRaw) / 1e18 : 0;

  // Fetch APE balance on ApeChain
  useEffect(() => {
    if (!isOpen || !address) return;
    
    apePublicClient
      .getBalance({ address })
      .then(setApeBalance)
      .catch(() => setApeBalance(null));
  }, [isOpen, address]);

  const handleCopy = async () => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={styles.header}>
            <h2 style={styles.title}>💰 WALLET</h2>
            <button 
              onClick={() => { playButtonSound(); onClose(); }} 
              style={styles.closeBtn}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={styles.body}>
            {/* Not connected state */}
            {!isConnected && (
              <div style={{...styles.card, background: '#4a3a1a', border: '1px solid #ffd700'}}>
                ⚠️ <strong>Connect your wallet</strong> to view details
              </div>
            )}

            {/* Wallet Info */}
            {isConnected && address && (
              <>
                <div style={styles.card}>
                  <div style={styles.sectionTitle}>Wallet Details</div>
                  
                  {/* Provider Badge */}
                  <div style={styles.row}>
                    <div style={styles.label}>Provider</div>
                    <div style={styles.value}>
                      <span style={{
                        ...styles.badge,
                        background: isGlyph ? 'linear-gradient(145deg, #9b59b6, #8e44ad)' : 'linear-gradient(145deg, #3498db, #2980b9)'
                      }}>
                        {isGlyph ? '🦍 Glyph Wallet' : '🔌 External Wallet'}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <div style={styles.row}>
                    <div style={styles.label}>Address</div>
                    <div style={styles.value}>
                      <span style={{ fontFamily: 'monospace' }}>{formatAddress(address)}</span>
                      <button 
                        onClick={handleCopy} 
                        style={styles.iconBtn}
                        title="Copy address"
                      >
                        📋
                      </button>
                      {copySuccess && (
                        <span style={styles.successToast}>Copied!</span>
                      )}
                    </div>
                  </div>

                  {/* Chain */}
                  <div style={styles.row}>
                    <div style={styles.label}>Chain</div>
                    <div style={styles.value}>
                      {chainId === APECHAIN_ID ? (
                        <span style={{ color: '#ffd700' }}>ApeChain (33139) ✓</span>
                      ) : (
                        <span>Chain {chainId}</span>
                      )}
                      {isGlyph && (
                        <span style={{...styles.badge, background: '#2ecc71', fontSize: 10, marginLeft: 8}}>
                          ApeChain Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balances */}
                  <div style={styles.divider} />
                  
                  <div style={styles.row}>
                    <div style={styles.label}>APE Balance</div>
                    <div style={styles.value}>
                      {apeBalance !== null ? (
                        <strong>{Number(formatEther(apeBalance)).toFixed(6)} APE</strong>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.label}>MNESTR Balance</div>
                    <div style={styles.value}>
                      <strong>{mnestrBalance.toLocaleString()} MNESTR</strong>
                    </div>
                  </div>
                </div>

                {/* Buy APE Section */}
                <div style={styles.card}>
                  <div style={styles.sectionTitle}>Buy APE with Card</div>
                  <div style={{ ...styles.hint, marginBottom: 12 }}>
                    💳 Purchase APE directly to your wallet using credit/debit card
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { playButtonSound(); setShowCheckout('5'); }}
                      style={{...styles.primaryBtn, flex: 1, fontSize: 13}}
                    >
                      £5
                    </button>
                    <button
                      onClick={() => { playButtonSound(); setShowCheckout('10'); }}
                      style={{...styles.primaryBtn, flex: 1, fontSize: 13}}
                    >
                      £10
                    </button>
                    <button
                      onClick={() => { playButtonSound(); setShowCheckout('25'); }}
                      style={{...styles.primaryBtn, flex: 1, fontSize: 13}}
                    >
                      £25
                    </button>
                  </div>
                </div>

                {/* Bridge Gas Button */}
                <div style={styles.card}>
                  <button
                    onClick={() => setShowBridge(true)}
                    disabled={isGlyph}
                    style={{
                      ...styles.primaryBtn,
                      opacity: isGlyph ? 0.5 : 1,
                      cursor: isGlyph ? 'not-allowed' : 'pointer'
                    }}
                    title={isGlyph ? 'Glyph is ApeChain-only. Use external wallet to bridge from other chains.' : 'Bridge gas to ApeChain'}
                  >
                    ⛽ Bridge Gas to ApeChain
                  </button>
                  {isGlyph && (
                    <div style={styles.hint}>
                      💡 Glyph is ApeChain-only. To bridge from other chains, connect an external wallet (MetaMask, Coinbase, etc.).
                    </div>
                  )}
                </div>

                {/* Send APE Section */}
                <SendAPESection
                  isGlyph={isGlyph}
                  currentChainId={chainId}
                  onSuccess={() => {
                    // Refresh balances after send
                    if (address) {
                      apePublicClient.getBalance({ address }).then(setApeBalance).catch(() => {});
                    }
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Relay Bridge Modal */}
      {showBridge && (
        <RelayBridgeModalSDK
          isOpen={showBridge}
          onClose={() => setShowBridge(false)}
          suggestedAmount="0.01"
        />
      )}

      {/* Thirdweb Checkout Modal */}
      {showCheckout && address && (
        <div style={styles.backdrop} onClick={() => setShowCheckout(null)}>
          <div style={{...styles.modal, maxWidth: 400}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 style={styles.title}>💳 Buy £{showCheckout} APE</h2>
              <button 
                onClick={() => { playButtonSound(); setShowCheckout(null); }} 
                style={styles.closeBtn}
              >
                ×
              </button>
            </div>
            <div style={styles.body}>
              <div style={{ position: 'relative' }}>
                <PayEmbed
                  client={thirdwebClient}
                  payOptions={{
                    mode: 'fund_wallet',
                    prefillBuy: {
                      chain: thirdwebApechain,
                      amount: showCheckout,
                    },
                  }}
                />
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setShowCheckout(null);
                      // Refresh balance
                      if (address) {
                        apePublicClient
                          .getBalance({ address })
                          .then(setApeBalance)
                          .catch(() => setApeBalance(null));
                      }
                    }}
                    style={{...styles.primaryBtn, fontSize: 12}}
                  >
                    Close & Refresh Balance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Send APE Section Component
function SendAPESection({ 
  isGlyph, 
  currentChainId, 
  onSuccess 
}: { 
  isGlyph: boolean; 
  currentChainId: number; 
  onSuccess: () => void;
}) {
  const { address: fromAddress } = useActiveAccount();
  const { send, state, reset, isIdle, isPending, isConfirming, isSuccess, isError } = useSendAPE();

  const [recipientInput, setRecipientInput] = useState('');
  const [resolved, setResolved] = useState<ArcadeUser | { address: `0x${string}`; arcadeName?: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const recipientType = useMemo(() => detectRecipientType(recipientInput), [recipientInput]);

  const resolveRecipient = async () => {
    if (!recipientInput.trim()) return;
    
    setIsResolving(true);
    setResolveError('');
    setResolved(null);

    try {
      if (recipientType === 'arcade') {
        const user = await lookupArcadeName(recipientInput);
        setResolved(user);
      } else if (recipientType === 'address') {
        if (isAddress(recipientInput)) {
          setResolved({ address: recipientInput as `0x${string}` });
        } else {
          setResolveError('Invalid address format');
        }
      } else {
        setResolveError('Enter @ArcadeName or 0x... address');
      }
    } catch (error: any) {
      setResolveError(error.message || 'Failed to resolve recipient');
    } finally {
      setIsResolving(false);
    }
  };

  const canSend = Boolean(
    resolved?.address &&
    amount &&
    Number(amount) >= 0.0001 &&
    currentChainId === APECHAIN_ID &&
    fromAddress &&
    isIdle
  );

  const handleSend = async () => {
    if (!resolved || !canSend) return;
    
    try {
      await send({ to: resolved.address, amount });
      onSuccess();
      // Reset form after success
      setTimeout(() => {
        setRecipientInput('');
        setResolved(null);
        setAmount('');
        reset();
      }, 3000);
    } catch (error) {
      // Error is handled by useSendAPE hook
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.sectionTitle}>📤 Send APE</div>

      {/* Chain warning */}
      {currentChainId !== APECHAIN_ID && (
        <div style={{...styles.hint, background: '#4a3a1a', border: '1px solid #ffd700', padding: 12}}>
          ⚠️ Switch to ApeChain (33139) to send APE
        </div>
      )}

      {/* Recipient Input */}
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Recipient</label>
        <input
          type="text"
          placeholder="@ArcadeName or 0x..."
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          onBlur={resolveRecipient}
          disabled={!isIdle}
          style={styles.input}
        />
        {isResolving && <div style={styles.hint}>🔍 Looking up...</div>}
        {resolveError && <div style={{...styles.hint, color: '#ff4444'}}>{resolveError}</div>}
        
        {/* Resolved recipient */}
        {resolved && !resolveError && (
          <div style={styles.resolved}>
            {'arcadeName' in resolved && resolved.arcadeName && (
              <strong style={{ color: '#ffd700' }}>{resolved.arcadeName}</strong>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.8 }}>
              {formatAddress(resolved.address)}
            </span>
          </div>
        )}
      </div>

      {/* Amount Input */}
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Amount (APE)</label>
        <input
          type="number"
          min="0.0001"
          step="0.0001"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!isIdle}
          style={styles.input}
        />
        <div style={styles.hint}>Minimum: 0.0001 APE</div>
      </div>

      {/* Review Summary */}
      {resolved && amount && Number(amount) >= 0.0001 && (
        <div style={styles.review}>
          <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#ffd700' }}>
            Review Transaction
          </div>
          <div style={{ fontSize: 11 }}>
            <div>From: {fromAddress ? formatAddress(fromAddress) : '—'}</div>
            <div>
              To: {'arcadeName' in resolved && resolved.arcadeName ? 
                `${resolved.arcadeName} (${formatAddress(resolved.address)})` : 
                formatAddress(resolved.address)
              }
            </div>
            <div>Amount: <strong>{amount} APE</strong></div>
          </div>
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!canSend || isPending || isConfirming}
        style={{
          ...styles.primaryBtn,
          opacity: canSend && !isPending && !isConfirming ? 1 : 0.5,
          cursor: canSend && !isPending && !isConfirming ? 'pointer' : 'not-allowed'
        }}
      >
        {isPending && '⏳ Preparing...'}
        {isConfirming && '⏳ Confirming...'}
        {!isPending && !isConfirming && '💸 Send APE'}
      </button>

      {/* Transaction Status */}
      {isConfirming && state.explorerUrl && (
        <div style={{...styles.hint, color: '#ffd700'}}>
          ⏳ Transaction submitted. <a href={state.explorerUrl} target="_blank" rel="noreferrer" style={{ color: '#ffd700', textDecoration: 'underline' }}>View on Explorer →</a>
        </div>
      )}

      {isSuccess && state.explorerUrl && (
        <div style={{...styles.hint, color: '#2ecc71'}}>
          ✅ Sent successfully! <a href={state.explorerUrl} target="_blank" rel="noreferrer" style={{ color: '#2ecc71', textDecoration: 'underline' }}>View on Explorer →</a>
        </div>
      )}

      {isError && (
        <div style={{...styles.hint, color: '#ff4444'}}>
          ❌ {state.errorMsg || 'Transaction failed'}
        </div>
      )}
    </div>
  );
}

// Styles
const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 20,
  },
  modal: {
    background: '#0f2c1b',
    border: '2px solid #4a7d5f',
    borderRadius: 8,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '2px solid #4a7d5f',
    background: 'linear-gradient(145deg, #1a4d2a, #2d5a3d)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    color: '#c8ffc8',
    fontWeight: 'bold' as const,
    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#c8ffc8',
    fontSize: 24,
    cursor: 'pointer',
    padding: '0 8px',
  },
  body: {
    padding: 20,
    color: '#c8ffc8',
    maxHeight: 'calc(90vh - 60px)',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  card: {
    background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
    padding: 16,
    borderRadius: 8,
    border: '2px solid #4a7d5f',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    marginBottom: 12,
    color: '#4a7d5f',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  label: {
    fontSize: 12,
    opacity: 0.7,
  },
  value: {
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: 'white',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
  },
  successToast: {
    fontSize: 11,
    color: '#2ecc71',
    fontWeight: 'bold' as const,
  },
  divider: {
    height: 1,
    background: '#4a7d5f',
    margin: '12px 0',
  },
  primaryBtn: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
    color: '#c8ffc8',
    border: '2px solid #64ff8a',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold' as const,
    fontFamily: 'Menlo, monospace',
  },
  hint: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 8,
    lineHeight: 1.4,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 'bold' as const,
  },
  input: {
    width: '100%',
    padding: '10px',
    background: '#0a1f14',
    border: '1px solid #4a7d5f',
    borderRadius: 4,
    color: '#c8ffc8',
    fontSize: 14,
  },
  resolved: {
    marginTop: 8,
    padding: 8,
    background: '#1a4d2a',
    borderRadius: 4,
    border: '1px solid #4a7d5f',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  review: {
    padding: 12,
    background: '#1a4d2a',
    borderRadius: 4,
    border: '1px solid #ffd700',
    marginBottom: 12,
  },
};

