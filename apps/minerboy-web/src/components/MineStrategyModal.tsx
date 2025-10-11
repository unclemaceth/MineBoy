'use client';

import { useEffect, useState } from 'react';
import { BuyButton } from './BuyButton';
import { thirdwebClient } from '@/app/ThirdwebProvider';
import { defineChain } from 'thirdweb/chains';
import { PayEmbed } from 'thirdweb/react';
import { useActiveAccount } from '@/hooks/useActiveAccount';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://mineboy-g5xo.onrender.com';
const NPC_CONTRACT = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const FLYWHEEL_WALLET = '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4'; // Flywheel wallet that receives NPC payments

// NOTE: This modal is NOW wrapped in DeviceModal by the parent (MineBoyDevice)
// So we DON'T use position:fixed or vh units anymore - just fill the space given to us

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

type MineStrategyModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type FlywheelStats = {
  apeBalance: string;
  mnestrPrice: string;
  mnestrMarketCap: string;
  mnestrCap: string;
  mnestrSupply: string;
  mnestrUnminted: string;
  mnestrBurned: string;
  cheapestNPC: {
    tokenId: string;
    price: string;
  } | null;
  ownedNPCs: Array<{
    tokenId: string;
    listedPrice: string | null;
    acquired: string;
  }>;
  previousSales: Array<{
    tokenId: string;
    soldPrice: string;
    profit: string;
    date: string;
  }>;
};

export default function MineStrategyModal({ isOpen, onClose }: MineStrategyModalProps) {
  const [stats, setStats] = useState<FlywheelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingNPC, setListingNPC] = useState<string | null>(null); // Track which NPC is being listed
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Function to trigger listing for a specific NPC
  const handleListNPC = async (tokenId: string) => {
    try {
      setListingNPC(tokenId);
      
      const response = await fetch(`${BACKEND_URL}/v2/flywheel/list/${tokenId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})  // Empty body required by Fastify
      });
      
      if (!response.ok) {
        throw new Error('Failed to list NPC');
      }
      
      setNotification({ message: `NPC #${tokenId} listed successfully!`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
      
      // Refresh stats
      const statsResponse = await fetch(`${BACKEND_URL}/v2/flywheel/stats`);
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
      }
      
    } catch (err) {
      console.error('Error listing NPC:', err);
      setNotification({ message: `Failed to list NPC #${tokenId}`, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setListingNPC(null);
    }
  };

  // Function to fetch stats (can be called externally)
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${BACKEND_URL}/v2/flywheel/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch flywheel stats');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching flywheel stats:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch flywheel stats from backend
  useEffect(() => {
    if (!isOpen) return;

    fetchStats();
    
    // Refresh every 90 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 90000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Now this component renders INSIDE DeviceModal wrapper, so no fixed positioning needed
  return (
    <>
      <div style={{
        backgroundColor: '#0f2c1b',
        border: '3px solid #4a7d5f',
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px',
        maxHeight: 'min(85vh, calc(var(--vh, 100vh) * 0.85))',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          marginBottom: '16px',
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
            MINESTRATEGY FLYWHEEL
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(145deg, #ff6b6b, #d63031)',
              color: 'white',
              border: '2px solid #8a8a8a',
              borderRadius: '6px',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div 
          className="hide-scrollbar"
          style={{
            overflowY: 'auto',
            flex: 1, // Fill remaining space in the flex container
            fontFamily: 'monospace',
            color: '#c8ffc8'
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>Loading...</div>
            </div>
          )}

          {error && (
            <div style={{
              backgroundColor: '#4a1a1a',
              border: '2px solid #8a3a3a',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#ff6b6b', fontSize: '14px' }}>{error}</div>
            </div>
          )}

          {!loading && !error && stats && (
            <>
              {/* APE Balance & MNESTR Stats */}
              <StatBox label="FLYWHEEL APE BALANCE" value={`${stats.apeBalance} APE`} />
              
              <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                <SectionTitle>MNESTR TOKEN STATS</SectionTitle>
              </div>
              
              <StatBox label="MNESTR PRICE" value={`${stats.mnestrPrice} APE`} />
              <StatBox label="MARKET CAP" value={`${stats.mnestrMarketCap} APE`} />
              <StatBox label="MAX SUPPLY (CAP)" value={stats.mnestrCap} />
              <StatBox label="CURRENT SUPPLY" value={stats.mnestrSupply} />
              <StatBox label="UNMINTED (REMAINING)" value={stats.mnestrUnminted} />
              <StatBox label="ACTUALLY BURNED" value={`${stats.mnestrBurned} 🔥`} highlight={true} />

              {/* Cheapest NPC */}
              {stats.cheapestNPC && (
                <div style={{ marginTop: '20px' }}>
                  <SectionTitle>CHEAPEST NPC AVAILABLE</SectionTitle>
                  <div style={{
                    backgroundColor: '#1a4d2a',
                    border: '2px solid #2d5a3d',
                    borderRadius: '6px',
                    padding: '12px',
                    marginTop: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>NPC #{stats.cheapestNPC.tokenId}</span>
                      <span style={{ color: '#ffd700' }}>{stats.cheapestNPC.price} APE</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Owned NPCs */}
                  {stats.ownedNPCs.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <SectionTitle>OWNED NPCs FOR SALE ({stats.ownedNPCs.length})</SectionTitle>
                      <div style={{ fontSize: '10px', color: '#88cc88', marginTop: '4px', marginBottom: '8px' }}>
                        Buy directly from the flywheel! Your purchase fuels the MNESTR burn 🔥
                      </div>
                  <div style={{ 
                    marginTop: '10px', 
                    maxHeight: '400px', 
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px'
                  }}>
                    {stats.ownedNPCs.map((npc) => (
                      <NPCCard
                        key={npc.tokenId}
                        tokenId={npc.tokenId}
                        listedPrice={npc.listedPrice}
                        onSuccess={() => {
                          setNotification({ message: 'Purchase successful! 🎉 You now own this NPC!', type: 'success' });
                          setTimeout(() => setNotification(null), 5000);
                          fetchStats();
                        }}
                        onError={(err) => {
                          setNotification({ message: err, type: 'error' });
                          setTimeout(() => setNotification(null), 5000);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Sales */}
              {stats.previousSales.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <SectionTitle>PREVIOUS SALES ({stats.previousSales.length})</SectionTitle>
                  <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {stats.previousSales.map((sale, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#1a4d2a',
                          border: '2px solid #2d5a3d',
                          borderRadius: '6px',
                          padding: '10px',
                          marginBottom: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px' }}>NPC #{sale.tokenId}</span>
                          <span style={{ color: '#ffd700', fontSize: '13px' }}>{sale.soldPrice} APE</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#88cc88' }}>{sale.date}</span>
                          <span style={{ color: '#4afa4a' }}>+{sale.profit} APE</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div style={{
                marginTop: '20px',
                backgroundColor: '#1a3d2a',
                border: '2px solid #3a6d4a',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '12px',
                lineHeight: '1.6'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>HOW IT WORKS:</div>
                <div>• Bot accumulates APE from 0.005 claim fees</div>
                <div>• Buys cheapest NPCs from marketplace</div>
                <div>• Relists at +20% markup</div>
                <div>• When sold: 99% APE → MNESTR → BURN</div>
                <div>• Remaining 1% APE → Gas & next purchase</div>
              </div>
            </>
          )}
        </div>
      </div> {/* Close modal container */}
      
      {/* Custom Notification */}
      {notification && (
        <div 
          className="notification-slide-in"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: notification.type === 'success' ? '#1a4d2a' : '#4d1a1a',
            border: `3px solid ${notification.type === 'success' ? '#2d5a3d' : '#5a2d2d'}`,
            borderRadius: '8px',
            padding: '16px 24px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            minWidth: '300px'
          }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>
              {notification.type === 'success' ? '✓' : '✗'}
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: notification.type === 'success' ? '#c8ffc8' : '#ffcccc',
              fontFamily: 'monospace'
            }}>
              {notification.message}
            </span>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes notificationSlideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .notification-slide-in {
          animation: notificationSlideIn 0.3s ease-out;
        }
      `}} />
    </>
  );
}

// Helper Components
function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      backgroundColor: highlight ? '#2d1a1a' : '#1a4d2a',
      border: `2px solid ${highlight ? '#5a2d2d' : '#2d5a3d'}`,
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span style={{ fontSize: '12px', color: highlight ? '#ff8888' : '#88cc88' }}>{label}</span>
      <span style={{ 
        fontSize: '14px', 
        fontWeight: 'bold', 
        color: highlight ? '#ffcccc' : '#c8ffc8' 
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#ffd700',
      borderBottom: '1px solid #4a7d5f',
      paddingBottom: '6px'
    }}>
      {children}
    </div>
  );
}

function NPCCard({ 
  tokenId, 
  listedPrice, 
  onSuccess, 
  onError
}: { 
  tokenId: string; 
  listedPrice: string | null; 
  onSuccess: () => void;
  onError: (err: string) => void;
}) {
  const { address } = useActiveAccount();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCardCheckout, setShowCardCheckout] = useState(false);

  useEffect(() => {
    const fetchNFTMetadata = async () => {
      try {
        const response = await fetch(
          `https://apechain-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTMetadata?contractAddress=${NPC_CONTRACT}&tokenId=${tokenId}&refreshCache=false`
        );
        
        if (response.ok) {
          const data = await response.json();
          const imageUrl = data?.image?.cachedUrl || data?.image?.originalUrl || data?.image?.thumbnailUrl || '';
          setImageUrl(imageUrl);
        }
      } catch (err) {
        console.error('Error fetching NPC metadata:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTMetadata();
  }, [tokenId]);

  return (
    <div style={{
      backgroundColor: '#1a4d2a',
      border: '2px solid #2d5a3d',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Image */}
      <div style={{
        width: '100%',
        aspectRatio: '1 / 1',
        backgroundColor: '#0d2417',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {loading ? (
          <div style={{ fontSize: '10px', color: '#88cc88' }}>Loading...</div>
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`NPC #${tokenId}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{ fontSize: '24px' }}>🤖</div>
        )}
      </div>

      {/* Info */}
      <div style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>#{tokenId}</span>
          {listedPrice && (
            <span style={{ color: '#ffd700', fontSize: '11px', fontWeight: 'bold' }}>
              {listedPrice} APE
            </span>
          )}
        </div>

        {listedPrice ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <BuyButton 
                tokenId={tokenId}
                priceLabel="APE"
                onSuccess={onSuccess}
                onError={onError}
              />
              <button
                disabled
                title="Coming soon - Currently limited to EU/US regions"
                style={{
                  background: 'linear-gradient(145deg, #3a3a3a, #2a2a2a)',
                  border: '2px solid #4a4a4a',
                  borderRadius: '4px',
                  color: '#888',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '6px',
                  cursor: 'not-allowed',
                  fontFamily: 'monospace',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  opacity: 0.5,
                }}
              >
                💳 Card (Coming Soon)
              </button>
            </div>
            
            {/* Card Checkout Modal */}
            {showCardCheckout && address && (
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                  padding: 20,
                }}
                onClick={() => setShowCardCheckout(false)}
              >
                <div 
                  style={{
                    background: '#0f2c1b',
                    border: '2px solid #4a7d5f',
                    borderRadius: '8px',
                    maxWidth: 400,
                    width: '100%',
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
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
                      fontSize: '16px',
                      color: '#c8ffc8',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                    }}>
                      💳 Buy NPC #{tokenId}
                    </h2>
                    <button
                      onClick={() => setShowCardCheckout(false)}
                      style={{
                        background: 'linear-gradient(145deg, #ff6b6b, #d63031)',
                        color: 'white',
                        border: '2px solid #8a8a8a',
                        borderRadius: '6px',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <PayEmbed
                      client={thirdwebClient}
                      payOptions={{
                        mode: 'direct_payment',
                        paymentInfo: {
                          amount: listedPrice,
                          chain: thirdwebApechain,
                          token: {
                            address: '0x0000000000000000000000000000000000000000',
                          },
                          sellerAddress: FLYWHEEL_WALLET,
                        },
                        metadata: {
                          name: `NPC #${tokenId}`,
                          description: `Purchase NPC #${tokenId} from MineStrategy Flywheel for ${listedPrice} APE`,
                        },
                      }}
                    />
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setShowCardCheckout(false);
                          onSuccess();
                        }}
                        style={{
                          background: 'linear-gradient(145deg, #4a7d5f, #2a5d3f)',
                          border: '2px solid #5a9d7f',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          padding: '10px 20px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          width: '100%',
                        }}
                      >
                        Close & Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            fontSize: '9px', 
            color: '#88cc88', 
            textAlign: 'center',
            padding: '4px'
          }}>
            Preparing for sale...
          </div>
        )}
      </div>
    </div>
  );
}
