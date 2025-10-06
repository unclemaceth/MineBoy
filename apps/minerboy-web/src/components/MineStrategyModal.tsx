'use client';

import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://mineboy-g5xo.onrender.com';

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

  // Function to trigger listing for a specific NPC
  const handleListNPC = async (tokenId: string) => {
    try {
      setListingNPC(tokenId);
      
      const response = await fetch(`${BACKEND_URL}/v2/flywheel/list/${tokenId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to list NPC');
      }
      
      alert(`NPC #${tokenId} listed successfully!`);
      
      // Refresh stats
      const statsResponse = await fetch(`${BACKEND_URL}/v2/flywheel/stats`);
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
      }
      
    } catch (err) {
      console.error('Error listing NPC:', err);
      alert(`Failed to list NPC #${tokenId}`);
    } finally {
      setListingNPC(null);
    }
  };

  // Fetch flywheel stats from backend
  useEffect(() => {
    if (!isOpen) return;

    async function fetchStats() {
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
    }

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
                  <SectionTitle>OWNED NPCs ({stats.ownedNPCs.length})</SectionTitle>
                  <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {stats.ownedNPCs.map((npc) => (
                      <div
                        key={npc.tokenId}
                        style={{
                          backgroundColor: '#1a4d2a',
                          border: '2px solid #2d5a3d',
                          borderRadius: '6px',
                          padding: '10px',
                          marginBottom: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>NPC #{npc.tokenId}</span>
                          
                          {!npc.listedPrice && (
                            <button
                              onClick={() => handleListNPC(npc.tokenId)}
                              disabled={listingNPC === npc.tokenId}
                              style={{
                                backgroundColor: listingNPC === npc.tokenId ? '#666' : '#ffd700',
                                color: '#000',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: listingNPC === npc.tokenId ? 'not-allowed' : 'pointer',
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (listingNPC !== npc.tokenId) {
                                  e.currentTarget.style.opacity = '0.8';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                            >
                              {listingNPC === npc.tokenId ? 'Listing...' : 'List for Sale'}
                            </button>
                          )}
                          
                          {npc.listedPrice && (
                            <span style={{ color: '#ffd700', fontSize: '12px' }}>
                              Listed: {npc.listedPrice} APE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#88cc88' }}>
                          Status: {npc.listedPrice ? 'Listed on marketplace' : 'Not listed yet'}
                        </div>
                      </div>
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
