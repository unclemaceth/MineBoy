'use client';
import { useEffect, useMemo, useState } from 'react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
import { apiGetIndividualLeaderboard, apiGetTeamLeaderboard, SeasonLeaderboardResponse, TeamLeaderboardResponse } from '@/lib/api';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import Stage from '@/components/Stage';
import TeamSelector from '@/components/TeamSelector';
import ArcadeNameSelector from '@/components/ArcadeNameSelector';



const LEADERBOARD_TYPES = ['individual', 'team'] as const;
type LeaderboardType = typeof LEADERBOARD_TYPES[number];

function formatUpdateTime(isoString?: string) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

function getNextPollerTime(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const nextPollerMinute = Math.ceil(minutes / 10) * 10;
  const nextPoller = new Date(now);
  nextPoller.setMinutes(nextPollerMinute % 60);
  nextPoller.setSeconds(0);
  nextPoller.setMilliseconds(0);
  
  if (nextPollerMinute >= 60) {
    nextPoller.setHours(nextPoller.getHours() + 1);
    nextPoller.setMinutes(0);
  }
  
  return nextPoller.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

// Consistent grid template for all leaderboard rows
const GRID_COLS = '40px 1.7fr 0.9fr minmax(72px,100px)';

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('individual');
  const [seasonData, setSeasonData] = useState<SeasonLeaderboardResponse | TeamLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[LEADERBOARD] Fetching season data for type:', leaderboardType, 'wallet:', address);
      
      // Always use season-based APIs
      if (leaderboardType === 'individual') {
        const resp = await apiGetIndividualLeaderboard('active', 25, 0, address);
        console.log('[LEADERBOARD] Received season individual response:', resp);
        setSeasonData(resp);
      } else {
        const resp = await apiGetTeamLeaderboard('active');
        console.log('[LEADERBOARD] Received season team response:', resp);
        setSeasonData(resp);
      }
    } catch (error) {
      console.error('[LEADERBOARD] Error fetching season data:', error);
      setSeasonData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchData();
    return () => { cancelled = true; };
  }, [leaderboardType, address]);

  // Auto-refresh every 30 seconds to catch new confirmations
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [leaderboardType, address]);


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
            <div style={{
              fontSize: '10px',
              color: '#666',
              marginTop: '4px'
            }}>
              Next update ~{getNextPollerTime()}
            </div>
          </div>
        </div>

        {/* Period Selector */}
        {/* Leaderboard Type Selector */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {LEADERBOARD_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setLeaderboardType(type)}
              style={{
                background: leaderboardType === type 
                  ? 'linear-gradient(145deg, #1a3d24, #4a7d5f)' 
                  : 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                border: '2px solid #8a8a8a',
                borderRadius: '6px',
                color: '#c8ffc8',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                cursor: 'pointer',
                textTransform: 'capitalize',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease'
              }}
            >
              {type}
            </button>
          ))}
        </div>


        {/* Season Info */}
        {seasonData && (
          <div style={{
            background: '#1a2e1f',
            border: '2px solid #4a7d5f',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64ff8a',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              marginBottom: '4px'
            }}>
              ACTIVE SEASON: {(seasonData as any).season?.slug || 'Unknown'}
            </div>
            <div style={{
              fontSize: '10px',
              color: '#8a8a8a',
              fontFamily: 'monospace'
            }}>
              {leaderboardType === 'individual' ? 'Individual' : 'Team'} Leaderboard • 
              Started: {seasonData.season?.starts_at ? new Date(seasonData.season.starts_at).toLocaleDateString() : 'Unknown'}
              {seasonData.season?.ends_at && (
                <> • Ends: {new Date(seasonData.season.ends_at).toLocaleDateString()}</>
              )}
            </div>
          </div>
        )}

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
            gridTemplateColumns: GRID_COLS,
            gap: '8px',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#c8ffc8'
          }}>
            <div>#</div>
            <div>{leaderboardType === 'individual' ? 'MINER' : 'TEAM'}</div>
            <div>{leaderboardType === 'individual' ? 'TEAM' : 'MEMBERS'}</div>
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
            
            {!loading && seasonData?.entries?.length === 0 && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#8a8a8a',
                fontSize: '12px'
              }}>
                NO CONFIRMED MINTS YET
              </div>
            )}
            
            {!loading && seasonData?.entries?.map((e, index) => {
              // Handle season data format
              const entry = e as any;
              const entries = (seasonData as any)?.entries;
              
              return (
              <div 
                key={entry.wallet || entry.team_slug} 
                style={{
                  padding: '8px 12px',
                  borderBottom: index < entries.length - 1 ? '1px solid #1a4d2a' : 'none',
                  display: 'grid',
                  gridTemplateColumns: GRID_COLS,
                  gap: '8px',
                  fontSize: '10px',
                  color: '#c8ffc8',
                  background: index % 2 === 0 ? 'transparent' : 'rgba(26, 77, 42, 0.2)'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{entry.rank}</div>
                <div style={{ 
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace'
                }}>
                  {leaderboardType === 'individual' 
                    ? (entry.arcade_name ?? entry.walletShort ?? entry.wallet)
                    : (entry.name ?? entry.team_slug)
                  }
                </div>
                <div style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '12px',
                  color: '#64FF8A',
                  fontWeight: '700'
                }}>
                  {leaderboardType === 'individual' 
                    ? (entry.team_name ?? '—')
                    : (entry.members ? `${entry.members} members` : '—')
                  }
                </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{entry.totalABIT}</div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Your Rank Section */}
        {(leaderboardType === 'individual' && seasonData && 'me' in seasonData ? seasonData.me : null) && (
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
              gridTemplateColumns: GRID_COLS,
              gap: '8px',
              padding: '8px 12px',
              fontSize: '10px',
              color: '#c8ffc8',
              fontFamily: 'monospace',
              backgroundColor: 'rgba(45, 26, 15, 0.3)',
              borderRadius: '4px'
            }}>
              {(() => {
                const meData = leaderboardType === 'individual' && seasonData && 'me' in seasonData ? seasonData.me : null;
                return (
                  <>
                    <div style={{ fontWeight: 'bold' }}>#{meData?.rank ?? '—'}</div>
                    <div style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace'
                    }}>
                      {leaderboardType === 'individual' 
                        ? (meData?.arcade_name ?? meData?.walletShort)
                        : '—'
                      }
                    </div>
                    <div style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px',
                      color: '#64FF8A',
                      fontWeight: '700'
                    }}>
                      {leaderboardType === 'individual' 
                        ? ((meData as any)?.team_name ?? '—')
                        : '—'
                      }
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{meData?.totalABIT}</div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Team Selector */}
        <div style={{ marginTop: 24 }}>
          <TeamSelector />
        </div>

        {/* Arcade Name Selector */}
        <div style={{ marginTop: 16 }}>
          <ArcadeNameSelector />
        </div>

        {/* Team Standings */}
        <TeamStandings />
      </div>
    </Stage>
  );
}

// Team Standings Component
function TeamStandings() {
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
  }, []);

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
