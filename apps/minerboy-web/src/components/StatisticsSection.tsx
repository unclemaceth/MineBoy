'use client';

import { useState, useEffect } from 'react';

type StatisticsData = {
  totalMiners: number;
  totalCarts: number;
  totalABIT: string;
  totalClaims: number;
  activeMiners?: number; // Optional for future implementation
};

export default function StatisticsSection() {
  const [stats, setStats] = useState<StatisticsData>({
    totalMiners: 0,
    totalCarts: 0,
    totalABIT: '0',
    totalClaims: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // For now, we'll use mock data since we don't have these endpoints yet
        // In the future, these would be real API calls
        const mockStats: StatisticsData = {
          totalMiners: 1247,
          totalCarts: 892,
          totalABIT: '2,847,392',
          totalClaims: 5563,
          activeMiners: 89 // This would be real-time data
        };
        
        setStats(mockStats);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          📊 NETWORK STATISTICS
        </div>
        <div style={{ fontSize: '11px', color: '#8a8a8a', textAlign: 'center' }}>
          Loading statistics...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
      border: '2px solid #4a7d5f',
      borderRadius: '8px'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
        📊 NETWORK STATISTICS
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        fontSize: '11px',
        color: '#c8ffc8'
      }}>
        <div style={{
          padding: '8px',
          background: 'rgba(74, 125, 95, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(74, 125, 95, 0.3)'
        }}>
          <div style={{ color: '#64ff8a', fontWeight: 'bold', marginBottom: '2px' }}>
            TOTAL MINERS
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {stats.totalMiners.toLocaleString()}
          </div>
        </div>

        <div style={{
          padding: '8px',
          background: 'rgba(74, 125, 95, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(74, 125, 95, 0.3)'
        }}>
          <div style={{ color: '#64ff8a', fontWeight: 'bold', marginBottom: '2px' }}>
            TOTAL CARTS
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {stats.totalCarts.toLocaleString()}
          </div>
        </div>

        <div style={{
          padding: '8px',
          background: 'rgba(74, 125, 95, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(74, 125, 95, 0.3)'
        }}>
          <div style={{ color: '#64ff8a', fontWeight: 'bold', marginBottom: '2px' }}>
            TOTAL APEBIT
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {stats.totalABIT}
          </div>
        </div>

        <div style={{
          padding: '8px',
          background: 'rgba(74, 125, 95, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(74, 125, 95, 0.3)'
        }}>
          <div style={{ color: '#64ff8a', fontWeight: 'bold', marginBottom: '2px' }}>
            TOTAL CLAIMS
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {stats.totalClaims.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Active Miners - Future Feature */}
      {stats.activeMiners !== undefined && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(100, 255, 138, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(100, 255, 138, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ color: '#64ff8a', fontWeight: 'bold', fontSize: '10px', marginBottom: '2px' }}>
            🔴 ACTIVE MINERS (REAL-TIME)
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#64ff8a' }}>
            {stats.activeMiners}
          </div>
        </div>
      )}
    </div>
  );
}
