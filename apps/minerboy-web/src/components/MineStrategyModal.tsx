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
  mnestrSupply: string;
  totalBurned: string;
  cheapestNPC: {
    tokenId: string;
    price: string;
  } | null;
  ownedNPCs: Array<{
    tokenId: string;
    listedPrice: string;
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
              <StatBox label="MNESTR PRICE" value={`${stats.mnestrPrice} APE`} />
              <StatBox label="MNESTR MARKET CAP" value={`${stats.mnestrMarketCap} APE`} />
              <StatBox label="MNESTR SUPPLY" value={stats.mnestrSupply} />
              <StatBox label="MNESTR BURNED" value={stats.totalBurned} />

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
                  <SectionTitle>OWNED & LISTED NPCs ({stats.ownedNPCs.length})</SectionTitle>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px' }}>NPC #{npc.tokenId}</span>
                          <span style={{ color: '#ffd700', fontSize: '13px' }}>{npc.listedPrice} APE</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#88cc88' }}>
                          Acquired: {npc.acquired}
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
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      backgroundColor: '#1a4d2a',
      border: '2px solid #2d5a3d',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span style={{ fontSize: '12px', color: '#88cc88' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#c8ffc8' }}>{value}</span>
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
