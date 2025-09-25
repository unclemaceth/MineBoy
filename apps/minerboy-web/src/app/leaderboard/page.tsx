'use client';
import { useEffect, useMemo, useState } from 'react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
import { api } from '@/lib/api';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import Stage from '@/components/Stage';
import TeamSelector from '@/components/TeamSelector';

type Entry = {
  rank: number;
  wallet: string;
  walletShort: string;
  totalABIT: string;
  team_slug?: string;
  team_name?: string;
  team_emoji?: string;
  team_color?: string;
};
type ApiResp = {
  period: 'all'|'24h'|'7d';
  entries: Entry[];
  me?: {
    rank: number|null;
    wallet: string;
    walletShort: string;
    totalABIT: string;
    team_slug?: string;
    team_name?: string;
    team_emoji?: string;
    team_color?: string;
  };
  lastUpdated?: string;
  nextUpdate?: string;
};


const PERIODS: Array<'all'|'24h'|'7d'> = ['all','24h','7d'];

function formatUpdateTime(isoString?: string) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [period, setPeriod] = useState<'all'|'24h'|'7d'>('all');
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[LEADERBOARD] Fetching data for period:', period, 'wallet:', address);
      const resp = await api.getLeaderboard({ period, limit: 25, ...(address ? { wallet: address } : {}) });
      console.log('[LEADERBOARD] Received response:', resp);
      setData(resp as ApiResp);
    } catch (error) {
      console.error('[LEADERBOARD] Error fetching data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchData();
    return () => { cancelled = true; };
  }, [period, address]);

  // Auto-refresh every 30 seconds to catch new confirmations
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period, address]);


  return (
    <Stage>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        fontFamily: 'monospace',
        color: '#c8ffc8',
        height: '100%'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
          maxWidth: '400px',
          marginBottom: '20px'
        }}>
          <Link 
            href="/" 
            style={{
              background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
              border: '2px solid #8a8a8a',
              borderRadius: '6px',
              color: '#c8ffc8',
              textDecoration: 'none',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              transition: 'all 0.1s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ← BACK
          </Link>
          
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              margin: 0
            }}>
              LEADERBOARD
            </h1>
            {data?.lastUpdated && (
              <div style={{
                fontSize: '10px',
                color: '#666',
                marginTop: '4px'
              }}>
                Updated {formatUpdateTime(data.lastUpdated)} • next update ~{formatUpdateTime(data.nextUpdate)}
              </div>
            )}
          </div>
        </div>

        {/* Period Selector */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px'
        }}>
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                background: period === p 
                  ? 'linear-gradient(145deg, #1a3d24, #4a7d5f)' 
                  : 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                border: '2px solid #8a8a8a',
                borderRadius: '6px',
                color: '#c8ffc8',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease'
              }}
              onMouseEnter={(e) => {
                if (period !== p) {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (period !== p) {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {p === 'all' ? 'ALL-TIME' : p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div style={{
          background: '#0f2c1b',
          border: '2px solid',
          borderTopColor: '#1a4d2a',
          borderLeftColor: '#1a4d2a',
          borderRightColor: '#3a8a4d',
          borderBottomColor: '#3a8a4d',
          borderRadius: '6px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            background: 'linear-gradient(145deg, #1a4d2a, #2d5a3d)',
            padding: '8px 12px',
            borderBottom: '1px solid #3a8a4d',
            display: 'grid',
            gridTemplateColumns: '40px 1fr 80px 100px',
            gap: '8px',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#c8ffc8'
          }}>
            <div>#</div>
            <div>MINER</div>
            <div>TEAM</div>
            <div style={{ textAlign: 'right' }}>ABIT</div>
          </div>

          {/* Table Body */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
            {loading && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#8a8a8a',
                fontSize: '12px'
              }}>
                LOADING...
              </div>
            )}
            
            {!loading && data?.entries?.length === 0 && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#8a8a8a',
                fontSize: '12px'
              }}>
                NO CONFIRMED MINTS YET
              </div>
            )}
            
            {!loading && data?.entries?.map((e, index) => (
              <div 
                key={e.wallet} 
                style={{
                  padding: '8px 12px',
                  borderBottom: index < data.entries.length - 1 ? '1px solid #1a4d2a' : 'none',
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 80px 100px',
                  gap: '8px',
                  fontSize: '10px',
                  color: '#c8ffc8',
                  background: index % 2 === 0 ? 'transparent' : 'rgba(26, 77, 42, 0.2)'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{e.rank}</div>
                <div style={{ 
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {e.walletShort}
                </div>
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#64ff8a', 
                          fontWeight: 'bold',
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '80px'
                        }}>
                          {e.team_name ?? '—'}
                        </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{e.totalABIT}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Rank Section */}
        {data?.me && (
          <div style={{
            background: '#2d1a0f',
            border: '2px solid',
            borderTopColor: '#4a2d1a',
            borderLeftColor: '#4a2d1a',
            borderRightColor: '#8a5a3a',
            borderBottomColor: '#8a5a3a',
            borderRadius: '6px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
            padding: '12px',
            marginTop: '16px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <div style={{
              fontSize: '10px',
              color: '#d4a574',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              YOUR RANK
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 80px 100px',
              gap: '8px',
              fontSize: '10px',
              color: '#c8ffc8',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontWeight: 'bold' }}>#{data.me.rank ?? '—'}</div>
              <div>{data.me.walletShort}</div>
              <div style={{ 
                fontSize: '10px', 
                color: '#64ff8a', 
                fontWeight: 'bold',
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '80px'
              }}>
                {data.me.team_name ?? '—'}
              </div>
              <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.me.totalABIT}</div>
            </div>
          </div>
        )}

        {/* Team Selector */}
        <div style={{ marginTop: 24 }}>
          <TeamSelector />
        </div>

        {/* Team Standings */}
        <TeamStandings period={period} />
      </div>
    </Stage>
  );
}

// Team Standings Component
function TeamStandings({ period }: { period: 'all' | '24h' | '7d' }) {
  const [teamData, setTeamData] = useState<Array<{ slug: string; name: string; emoji?: string; color?: string; members: number; total_score: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const { apiLeaderboardTeams } = await import('@/lib/api');
      const data = await apiLeaderboardTeams();
      setTeamData(data);
    } catch (error) {
      console.error('Failed to fetch team standings:', error);
      // If team standings endpoint is not available (404), show empty array
      setTeamData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [period]);

  return (
    <div style={{
      background: '#0f2c1b',
      border: '2px solid',
      borderTopColor: '#1a4d2a',
      borderLeftColor: '#1a4d2a',
      borderRightColor: '#3a8a4d',
      borderBottomColor: '#3a8a4d',
      borderRadius: '6px',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
      width: '100%',
      maxWidth: '400px',
      overflow: 'hidden',
      marginTop: '16px'
    }}>
      {/* Team Standings Header */}
      <div style={{
        background: 'linear-gradient(145deg, #1a4d2a, #2d5a3d)',
        padding: '8px 12px',
        borderBottom: '1px solid #3a8a4d',
        display: 'grid',
        gridTemplateColumns: '1fr 60px 80px',
        gap: '8px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: '#c8ffc8'
      }}>
        <div>TEAM</div>
        <div style={{ textAlign: 'center' }}>MEMBERS</div>
        <div style={{ textAlign: 'right' }}>TOTAL</div>
      </div>

      {/* Team Standings Body */}
      <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
        {loading && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#8a8a8a',
            fontSize: '12px'
          }}>
            LOADING TEAM STANDINGS...
          </div>
        )}
        
        {!loading && teamData && teamData.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#8a8a8a',
            fontSize: '12px'
          }}>
            Team standings coming soon...
          </div>
        )}
        
        {!loading && teamData && teamData.length > 0 && teamData.map((team, index) => (
          <div 
            key={team.slug} 
            style={{
              padding: '8px 12px',
              borderBottom: index < (teamData?.length || 0) - 1 ? '1px solid #1a4d2a' : 'none',
              display: 'grid',
              gridTemplateColumns: '1fr 60px 80px',
              gap: '8px',
              fontSize: '10px',
              color: '#c8ffc8',
              background: index % 2 === 0 ? 'transparent' : 'rgba(26, 77, 42, 0.2)',
              fontFamily: 'monospace'
            }}
          >
            <div style={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{team.emoji || '⚪'}</span>
              <span>{team.name}</span>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{team.members}</div>
            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{team.total_score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
