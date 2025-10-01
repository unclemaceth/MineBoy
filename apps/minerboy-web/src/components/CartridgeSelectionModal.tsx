'use client';
import React, { useState, useEffect } from 'react';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';

// Local animation URL for all cartridges
const CARTRIDGE_ANIMATION_URL = '/apebitcart.mp4';

interface CartridgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCartridge: (cartridge: OwnedCartridge) => void;
  lockedCartridge?: { contract: string; tokenId: string; ttl: number } | null;
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
}: CartridgeSelectionModalProps) {
  const { address, isConnected } = useActiveAccount();
  const [ownedCartridges, setOwnedCartridges] = useState<OwnedCartridge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && address) {
      loadOwnedCartridges();
    } else if (isOpen && !address) {
      // Clear stale list if user disconnected
      setOwnedCartridges([]);
    }
  }, [isOpen, address]);

  const loadOwnedCartridges = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const cartridges = await getOwnedCartridges(address);
      setOwnedCartridges(cartridges);
      if (!cartridges?.length) {
        // Helpful console for debugging contracts/filters
        console.log('[Alchemy] No cartridges found for', address);
      }
    } catch (err) {
      console.error('Error loading cartridges:', err);
      setError('Failed to load cartridges');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#2a4a3d',
        border: '3px solid #4a7d5f',
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
          textAlign: 'center'
        }}>
          SELECT CARTRIDGE
        </div>

        {!isConnected && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Connect a wallet to load your cartridges.
          </div>
        )}

        {loading && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Loading your cartridges...
          </div>
        )}

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            {error}
          </div>
        )}

        {!loading && !error && isConnected && ownedCartridges.length === 0 && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            No cartridges found in your wallet
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
                    backgroundColor: isLocked ? '#2a1a1a' : '#1a2e1f', 
                    border: isLocked ? '2px solid #ff6b6b' : '2px solid #4a7d5f',
                    borderRadius: 16, 
                    color: isLocked ? '#ff6b6b' : '#64ff8a', 
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
                    border: isLocked ? '3px solid #ff6b6b' : '3px solid #4a7d5f',
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
                        backgroundColor: 'rgba(255, 107, 107, 0.85)',
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
                          🔒
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
                          Session Conflict
                          <br />
                          Check other devices
                        </div>
                      </div>
                    )}
                    {/* Always show the PNG image first */}
                    <img
                      src="/apebit-cart-mineboy.png"
                      alt="Cartridge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onLoad={() => console.log('PNG image loaded successfully')}
                      onError={(e) => console.error('PNG image error:', e)}
                    />
                    {/* Video overlay (will hide the image when it loads) */}
                    <video
                      src={CARTRIDGE_ANIMATION_URL}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onLoadStart={() => console.log('Video loading started:', CARTRIDGE_ANIMATION_URL)}
                      onCanPlay={() => {
                        console.log('Video can play:', CARTRIDGE_ANIMATION_URL);
                        // Hide the image when video loads
                        const img = document.querySelector('img[alt="Cartridge"]') as HTMLImageElement;
                        if (img) img.style.display = 'none';
                      }}
                      onError={(e) => console.error('Video error:', e, CARTRIDGE_ANIMATION_URL)}
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
                  
                  {/* Cartridge Info - Centered underneath */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 6 }}>
                      Cartridge #{decId}
                    </div>
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
    </div>
  );
}