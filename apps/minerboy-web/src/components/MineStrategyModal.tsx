'use client';

import { useEffect, useState } from 'react';
import { BuyButton } from './BuyButton';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://mineboy-g5xo.onrender.com';
const NPC_CONTRACT = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

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
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
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
        maxWidth: '450px',
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
            padding: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 80px)',
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
      </div>
      
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
    </div>
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
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

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
          <BuyButton 
            tokenId={tokenId}
            priceLabel={`${listedPrice} APE`}
            onSuccess={onSuccess}
            onError={onError}
          />
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
