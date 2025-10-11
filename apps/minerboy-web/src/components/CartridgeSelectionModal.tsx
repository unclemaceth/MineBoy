'use client';
import React, { useState, useEffect } from 'react';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';

// Fallback URLs for unknown pickaxes
const FALLBACK_ANIMATION_URL = '/apebitcart.mp4';
const FALLBACK_IMAGE_URL = '/apebit-cart-mineboy.png';

interface CartridgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCartridge: (cartridge: OwnedCartridge) => void;
  lockedCartridge?: { contract: string; tokenId: string; ttl: number; type: 'conflict' | 'timeout' } | null;
  vaultAddress?: string; // Optional vault address for delegate.xyz support
}

const toDecString = (id: string) => {
  try {
    // already decimal?
    if (/^\d+$/.test(id)) return id;
    // hex or other → normalize
    const hex = id.startsWith('0x') ? id : `0x${id}`;
    return BigInt(hex).toString(10);
  } catch {
    return id; // last resort: pass through
  }
};

export default function CartridgeSelectionModal({
  isOpen,
  onClose,
  onSelectCartridge,
  lockedCartridge,
  vaultAddress,
}: CartridgeSelectionModalProps) {
  const { address, isConnected } = useActiveAccount();
  const [ownedCartridges, setOwnedCartridges] = useState<OwnedCartridge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use vault address if provided (delegate mode), otherwise use connected address
  const queryAddress = vaultAddress || address;

  useEffect(() => {
    if (isOpen && queryAddress) {
      loadOwnedCartridges();
    } else if (isOpen && !queryAddress) {
      // Clear stale list if user disconnected
      setOwnedCartridges([]);
    }
  }, [isOpen, queryAddress]);

  const loadOwnedCartridges = async () => {
    if (!queryAddress) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[Alchemy] Querying NFTs for:', vaultAddress ? `vault ${vaultAddress}` : `hot wallet ${address}`);
      const cartridges = await getOwnedCartridges(queryAddress);
      setOwnedCartridges(cartridges);
      if (!cartridges?.length) {
        // Helpful console for debugging contracts/filters
        console.log('[Alchemy] No cartridges found for', queryAddress);
      }
    } catch (err) {
      console.error('Error loading cartridges:', err);
      setError('Failed to load cartridges');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Now wrapped in DeviceModal, so no outer fixed wrapper needed
  return (
    <div style={{
      backgroundColor: '#2a4a3d',
      border: '3px solid #4a7d5f',
      borderRadius: 12,
      padding: 24,
      width: '100%',
      minWidth: '100%',
      maxWidth: 400,
      maxHeight: 'min(85vh, calc(var(--vh, 100vh) * 0.85))',
      overflowY: 'auto',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      boxSizing: 'border-box'
    }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
          textAlign: 'center'
        }}>
          SELECT PICKAXE
        </div>

        {!isConnected && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Connect a wallet to load your pickaxes.
          </div>
        )}

        {vaultAddress && (
          <div style={{ 
            color: '#4ade80', 
            fontSize: 12, 
            textAlign: 'center', 
            padding: '8px 12px', 
            background: 'rgba(74, 222, 128, 0.1)',
            borderRadius: 6,
            marginBottom: 12,
            fontFamily: 'Menlo, monospace',
            border: '1px solid rgba(74, 222, 128, 0.3)'
          }}>
            🔐 Loading NFTs from vault:<br/>
            {vaultAddress.slice(0, 6)}...{vaultAddress.slice(-4)}
          </div>
        )}

        {loading && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Loading your pickaxes...
          </div>
        )}

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            {error}
          </div>
        )}

        {!loading && !error && isConnected && ownedCartridges.length === 0 && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            No pickaxes found in {vaultAddress ? 'vault wallet' : 'your wallet'}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={loadOwnedCartridges}
                style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #4a7d5f',
                  background: 'transparent', color: '#64ff8a', cursor: 'pointer', fontFamily: 'Menlo, monospace' }}>
                Reload
              </button>
            </div>
          </div>
        )}

        {!loading && !error && ownedCartridges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ownedCartridges.map((c) => {
              const decId = toDecString(c.tokenId);
              const isLocked = lockedCartridge && 
                               lockedCartridge.contract.toLowerCase() === c.contractAddress.toLowerCase() && 
                               lockedCartridge.tokenId === decId;
              const lockType = isLocked ? lockedCartridge.type : null;
              const isTimeout = lockType === 'timeout';
              const isConflict = lockType === 'conflict';
              
              // Color scheme: blue for timeout, red for conflict
              const lockColor = isTimeout ? '#6b9bff' : '#ff6b6b'; // Blue or Red
              const lockBg = isTimeout ? '#1a1f2a' : '#2a1a1a'; // Dark blue or dark red
              
              return (
                <button
                  key={`${c.contractAddress}-${decId}`}
                  onClick={() => {
                    if (isLocked) return; // Don't allow selection of locked cartridge
                    onSelectCartridge({ ...c, tokenId: decId });
                  }}
                  disabled={!!isLocked}
                  style={{
                    padding: 24, 
                    backgroundColor: isLocked ? lockBg : '#1a2e1f', 
                    border: isLocked ? `2px solid ${lockColor}` : '2px solid #4a7d5f',
                    borderRadius: 16, 
                    color: isLocked ? lockColor : '#64ff8a', 
                    fontFamily: 'Menlo, monospace',
                    fontSize: 14, 
                    cursor: isLocked ? 'not-allowed' : 'pointer', 
                    textAlign: 'center', 
                    transition: 'all 0.2s',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: 16,
                    width: '100%',
                    position: 'relative',
                    opacity: isLocked ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isLocked) {
                      e.currentTarget.style.backgroundColor = '#4a7d5f';
                      e.currentTarget.style.borderColor = '#64ff8a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLocked) {
                      e.currentTarget.style.backgroundColor = '#1a2e1f';
                      e.currentTarget.style.borderColor = '#4a7d5f';
                    }
                  }}
                >
                  {/* Cartridge Image */}
                  <div style={{ 
                    width: 240, 
                    height: 240, 
                    borderRadius: 12, 
                    overflow: 'hidden',
                    backgroundColor: '#0f2216',
                    border: isLocked ? `3px solid ${lockColor}` : '3px solid #4a7d5f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {/* Locked Overlay */}
                    {isLocked && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: isTimeout ? 'rgba(107, 155, 255, 0.85)' : 'rgba(255, 107, 107, 0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        gap: 12
                      }}>
                        <div style={{
                          fontSize: 48,
                          fontWeight: 'bold',
                          color: '#fff',
                          fontFamily: 'Menlo, monospace'
                        }}>
                          {isTimeout ? '❄️' : '🔒'}
                        </div>
                        <div style={{
                          fontSize: 36,
                          fontWeight: 'bold',
                          color: '#fff',
                          fontFamily: 'Menlo, monospace'
                        }}>
                          {lockedCartridge.ttl}s
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: '#fff',
                          textAlign: 'center',
                          padding: '0 20px',
                          fontFamily: 'Menlo, monospace'
                        }}>
                          {isTimeout ? (
                            <>
                              Cooldown Active
                              <br />
                              Job timed out
                            </>
                          ) : (
                            <>
                              Session Conflict
                              <br />
                              Check other devices
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Always show the PNG image first (type-specific fallback) */}
                    <img
                      src={c.metadata?.fallbackPng || FALLBACK_IMAGE_URL}
                      alt="Cartridge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onLoad={() => console.log('PNG image loaded successfully:', c.metadata?.fallbackPng || FALLBACK_IMAGE_URL)}
                      onError={(e) => console.error('PNG image error:', e)}
                    />
                    {/* Video overlay (will hide the image when it loads) */}
                    <video
                      src={c.metadata?.videoUrl || FALLBACK_ANIMATION_URL}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onLoadStart={() => console.log('Video loading started:', c.metadata?.videoUrl || FALLBACK_ANIMATION_URL)}
                      onCanPlay={() => {
                        console.log('Video can play:', c.metadata?.videoUrl || FALLBACK_ANIMATION_URL);
                        // Hide the image when video loads
                        const img = document.querySelector('img[alt="Cartridge"]') as HTMLImageElement;
                        if (img) img.style.display = 'none';
                      }}
                      onError={(e) => console.error('Video error:', e, c.metadata?.videoUrl || FALLBACK_ANIMATION_URL)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 2
                      }}
                    />
                  </div>
                  
                  {/* Pickaxe Info - Centered underneath */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 6 }}>
                      {c.metadata?.type ? c.metadata.type.replace('The ', '').replace('The Morgul ', '') : 'Pickaxe'} #{decId}
                    </div>
                    {c.metadata?.hashRate && (
                      <div style={{ fontSize: 16, color: '#64ff8a', marginBottom: 4, fontWeight: 'bold' }}>
                        {c.metadata.hashRate.toLocaleString()} H/s
                      </div>
                    )}
                    <div style={{ fontSize: 14, color: '#4a7d5f' }}>
                      {c.contractAddress.slice(0, 6)}…{c.contractAddress.slice(-4)} • Chain {c.chainId}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '2px solid #4a7d5f',
              backgroundColor: 'transparent', color: '#64ff8a', cursor: 'pointer',
              fontFamily: 'Menlo, monospace'
            }}
          >
            Cancel
          </button>
        </div>
    </div>
  );
}