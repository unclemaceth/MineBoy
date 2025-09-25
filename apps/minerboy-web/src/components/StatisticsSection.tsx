'use client';

import { useState, useEffect } from 'react';

type StatisticsData = {
  totalMiners: number;
  totalCarts: number;
  totalABIT: string;
  totalClaims: number;
  activeMiners: number;
  snapshotDayUTC?: string;
  snapshotComputedAtMs?: number;
  computedOnFly?: boolean;
};

export default function StatisticsSection() {
  const [stats, setStats] = useState<StatisticsData>({
    totalMiners: 0,
    totalCarts: 0,
    totalABIT: '0',
    totalClaims: 0,
    activeMiners: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${apiBase}/v2/stats`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Convert wei to ABIT (assuming 18 decimals)
        const weiToABIT = (wei: string) => {
          const weiBigInt = BigInt(wei);
          const abitBigInt = weiBigInt / BigInt(10 ** 18);
          return abitBigInt.toString();
        };
        
        setStats({
          totalMiners: data.totalMiners || 0,
          totalCarts: data.totalCarts || 0,
          totalABIT: weiToABIT(data.totalWeiText || '0'),
          totalClaims: data.totalClaims || 0,
          activeMiners: data.activeMiners || 0,
          snapshotDayUTC: data.snapshotDayUTC,
          snapshotComputedAtMs: data.snapshotComputedAtMs,
          computedOnFly: data.computedOnFly
        });
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch stats');
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

  if (error) {
    return (
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #ff6b6b',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#ff6b6b' }}>
          ❌ NETWORK STATISTICS
        </div>
        <div style={{ fontSize: '11px', color: '#ff6b6b', textAlign: 'center' }}>
          Error: {error}
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

      {/* Active Miners - Real-time */}
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
          {stats.activeMiners.toLocaleString()}
        </div>
      </div>

      {/* Stats Info */}
      {stats.snapshotDayUTC && (
        <div style={{
          marginTop: '8px',
          padding: '4px',
          background: 'rgba(74, 125, 95, 0.1)',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: '#8a8a8a' }}>
            Daily stats as of {stats.snapshotDayUTC} UTC
            {stats.computedOnFly && ' (computed on-the-fly)'}
          </div>
        </div>
      )}
    </div>
  );
}
