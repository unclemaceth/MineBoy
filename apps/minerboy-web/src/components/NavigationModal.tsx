'use client';

import { useEffect, useState } from 'react';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { apiGetIndividualLeaderboard, apiGetTeamLeaderboard, SeasonLeaderboardResponse, TeamLeaderboardResponse } from '@/lib/api';
import { apiLeaderboardTeams } from '@/lib/api';
import TeamSelector from '@/components/TeamSelector';
import ArcadeNameSelector from '@/components/ArcadeNameSelector';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMintPrice } from '@/hooks/useMintPrice';
import { useBackendMint } from '@/hooks/useBackendMint';
import { useSpendChecks } from '@/hooks/useSpendChecks';
import { useContractState } from '@/hooks/useContractState';
import { useMintCounter } from '@/hooks/useMintCounter';
import { useWalletCartridgeCount } from '@/hooks/useWalletCartridgeCount';
import { formatEther } from 'viem';
import { EXPLORER_BASE, APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from "../lib/contracts";

// Season end time: October 3, 2025 at 8:00 PM GMT (48 hours after launch)
const SEASON_END_TIME = new Date('2025-10-03T20:00:00Z').getTime();

// Countdown timer formatting helper
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Season Ended';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const h = hours % 24;
    const m = minutes % 60;
    return `${days}d ${h}h ${m}m`;
  } else if (hours > 0) {
    const m = minutes % 60;
    const s = seconds % 60;
    return `${hours}h ${m}m ${s}s`;
  } else if (minutes > 0) {
    const s = seconds % 60;
    return `${minutes}m ${s}s`;
  } else {
    return `${seconds}s`;
  }
}

type NavigationModalProps = {
  isOpen: boolean;
  page: 'leaderboard' | 'mint' | 'instructions' | 'welcome' | null;
  onClose: () => void;
};

export default function NavigationModal({ isOpen, page, onClose }: NavigationModalProps) {
  if (!isOpen || !page) return null;

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
        maxWidth: '400px',
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
            {page === 'leaderboard' && 'LEADERBOARD'}
            {page === 'mint' && 'MINT CARTRIDGE'}
            {page === 'instructions' && 'HOW TO PLAY'}
            {page === 'welcome' && 'WELCOME TO MINEBOY'}
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
          {page === 'leaderboard' && <LeaderboardContent />}
          {page === 'mint' && <MintContent />}
          {page === 'instructions' && <InstructionsContent />}
          {page === 'welcome' && <WelcomeContent onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

// Consistent grid template for all leaderboard rows
const GRID_COLS = '40px minmax(0,1.8fr) minmax(0,0.6fr) 100px';

// Leaderboard Content Component
function LeaderboardContent() {
  const { address } = useActiveAccount();
  
  // Debug logging
  useEffect(() => {
    console.log('[NavigationModal] LeaderboardContent rendering with address:', address?.slice(0, 8) + '...' + address?.slice(-6));
  }, [address]);
  
  const [leaderboardType, setLeaderboardType] = useState<'individual' | 'team'>('individual');
  const [seasonData, setSeasonData] = useState<SeasonLeaderboardResponse | TeamLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(SEASON_END_TIME - Date.now());

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('[NavigationModal] Fetching season data for type:', leaderboardType, 'wallet:', address);
      
      if (leaderboardType === 'individual') {
        const resp = await apiGetIndividualLeaderboard('active', 100, 0, address);
        console.log('[NavigationModal] Received season individual response:', resp);
        setSeasonData(resp);
      } else {
        const resp = await apiGetTeamLeaderboard('active');
        console.log('[NavigationModal] Received season team response:', resp);
        setSeasonData(resp);
      }
    } catch (error) {
      console.error('[NavigationModal] Error fetching season data:', error);
      setSeasonData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [leaderboardType, address]);

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(SEASON_END_TIME - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUpdateTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getNextPollerTime = () => {
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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#64ff8a', marginBottom: 4 }}>LEADERBOARD</h2>
        <div style={{ fontSize: 10, color: '#8a8a8a' }}>
          Next update ~{getNextPollerTime()}
        </div>
        {/* Season countdown timer */}
        <div style={{ 
          marginTop: 12, 
          padding: '8px 16px', 
          background: 'linear-gradient(180deg, #2d1f0f, #3d2a14)',
          borderRadius: '6px',
          border: '2px solid #ff8a00'
        }}>
          <div style={{ color: '#ffc864', fontSize: '11px', fontWeight: 'bold', marginBottom: 4 }}>
            ⏱️ SEASON 1 ENDS
          </div>
          <div style={{ color: '#ff8a00', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {formatTimeRemaining(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Leaderboard Type Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['individual', 'team'] as const).map(type => (
          <button
            key={type}
            onClick={() => setLeaderboardType(type)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 12,
              fontFamily: 'monospace',
              cursor: 'pointer',
              background: leaderboardType === type
                ? 'linear-gradient(145deg, #1a4d2a, #2d5a3d)'
                : 'linear-gradient(145deg, #0f2c1b, #1a3d24)',
              border: leaderboardType === type ? '2px solid #64ff8a' : '2px solid #4a7d5f',
              color: leaderboardType === type ? '#c8ffc8' : '#8a8a8a',
              boxShadow: leaderboardType === type ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
              transition: 'all 0.1s ease',
              textTransform: 'capitalize'
            }}
          >
            {type}
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
        overflow: 'hidden'
      }}>
        {/* Table Header */}
        <div style={{
          background: 'linear-gradient(145deg, #1a4d2a, #2d5a3d)',
          padding: '8px 12px',
          borderBottom: '1px solid #3a8a4d',
          display: 'grid',
          gridTemplateColumns: '40px 1.4fr 0.8fr 100px',
          gap: '8px',
          fontSize: '10px',
          fontWeight: 'bold',
          color: '#c8ffc8'
        }}>
          <div>#</div>
          <div>{leaderboardType === 'individual' ? 'MINER' : 'TEAM'}</div>
          <div>{leaderboardType === 'individual' ? 'TEAM' : 'MEMBERS'}</div>
          <div style={{ textAlign: 'right' }}>MNESTR</div>
        </div>

        {/* Table Body */}
        <div className="hide-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {loading && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#8a8a8a',
              fontSize: '12px'
            }}>
              Loading...
            </div>
          )}

          {!loading && (!seasonData?.entries || seasonData.entries.length === 0) && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#8a8a8a',
              fontSize: '12px'
            }}>
              No entries yet.
            </div>
          )}
          
          {!loading && seasonData?.entries?.map((e: any, index: number) => {
            const entry = e;
            const entries = (seasonData as any)?.entries;
            return (
            <div 
              key={entry.wallet || entry.team_slug} 
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                gap: '8px',
                padding: '8px 12px',
                borderBottom: index === (entries?.length || 0) - 1 ? 'none' : '1px solid #1a3d24',
                backgroundColor: index % 2 === 0 ? '#0f2c1b' : '#1a3d24',
                fontSize: '10px',
                color: '#c8ffc8',
                fontFamily: 'monospace'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{entry.rank}</div>
              <div 
                style={{ 
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace'
                }}
                title={leaderboardType === 'individual' 
                  ? (entry.arcade_name ?? entry.walletShort ?? entry.wallet)
                  : (entry.name ?? entry.team_slug)
                }
              >
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
              <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{entry.totalMNESTR}</div>
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
          width: '100%'
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
                  <div 
                    style={{ 
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace'
                    }}
                    title={leaderboardType === 'individual' 
                      ? (meData?.arcade_name ?? meData?.walletShort)
                      : '—'
                    }
                  >
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
                  <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{meData?.totalMNESTR}</div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Team Selector */}
      <div style={{ marginTop: 24, width: '100%' }}>
        <TeamSelector />
      </div>

      {/* Arcade Name Selector */}
      <div style={{ marginTop: 16, width: '100%' }}>
        <ArcadeNameSelector />
      </div>

      {/* Team Standings - Commented out as team data is now integrated into main leaderboard */}
      {/* <TeamStandings /> */}
    </div>
  );
}

// Team Standings Component
function TeamStandings() {
  const [teamData, setTeamData] = useState<Array<any>>([]);
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
      <div className="hide-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto' }}>
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

// Mint Content Component V2 - Minting Closed
function MintContent() {
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ color: '#64ff8a', marginBottom: '16px' }}>Mint Pickaxes</h3>
      
      {/* Sold Out Banner */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '20px', 
        background: 'linear-gradient(180deg, #2d1f0f, #3d2a14)',
        borderRadius: '8px',
        border: '2px solid #ff8a00'
      }}>
        <p style={{ color: '#ffc864', fontSize: '18px', fontWeight: 'bold', margin: '0', textTransform: 'uppercase' }}>
          🔒 Minting Closed
        </p>
      </div>
      
      {/* Secondary Market Info */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        borderRadius: '8px',
        border: '2px solid #4a7d5f',
        textAlign: 'left'
      }}>
        <p style={{ color: '#c8ffc8', fontSize: '15px', margin: '0 0 12px 0', fontWeight: 'bold' }}>
          🛒 Buy Pickaxes on Secondary:
        </p>
        <p style={{ color: '#c8ffc8', fontSize: '14px', margin: '0 0 12px 0', lineHeight: '1.5' }}>
          Primary mint is sold out. You can purchase pickaxes on the secondary market:
        </p>
        <a 
          href="https://magiceden.io/collections/apechain/0x3322b37349aefd6f50f7909b641f2177c1d34d25"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: '6px',
            background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
            color: '#c8ffc8',
            border: '2px solid #64ff8a',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #5a8d6f, #2a4d34)';
            e.currentTarget.style.borderColor = '#84ffa4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
            e.currentTarget.style.borderColor = '#64ff8a';
          }}
        >
          🎨 View on Magic Eden
        </a>
      </div>

      {/* Mining Info */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        borderRadius: '8px',
        border: '1px solid #4a7d5f',
        textAlign: 'left'
      }}>
        <p style={{ color: '#c8ffc8', fontSize: '15px', margin: '0 0 12px 0', fontWeight: 'bold' }}>
          ⛏️ About Pickaxes:
        </p>
        <p style={{ color: '#c8ffc8', fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
          • Each pickaxe mines $MNESTR token rewards
        </p>
        <p style={{ color: '#c8ffc8', fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
          • 0.01 APE tax per claim (distributed to ecosystem)
        </p>
        <p style={{ color: '#c8ffc8', fontSize: '14px', margin: '0', lineHeight: '1.5' }}>
          • Hold NPCs for reward multipliers (1.2x - 1.5x)
        </p>
      </div>

    </div>
  );
}

// Instructions Content Component
function InstructionsContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          ⛏️ PICKS & MINECARTS
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p style={{ marginBottom: '8px' }}>Picks from <strong>The Mine</strong> are transformed on entry to the MineBoy dApp. Each Pick becomes a MineCart!</p>
          <p><strong>The DripAxe:</strong> up to 8000 H/s Mining Speed</p>
          <p><strong>The Morgul PickHammer:</strong> up to 7000 H/s Mining Speed</p>
          <p><strong>The Blue Steel:</strong> up to 6000 H/s Mining Speed</p>
          <p><strong>Ol' Rusty:</strong> COMING SOON - 5000 H/s Mining Speed</p>
          <p style={{ marginTop: '8px', fontSize: '11px', color: '#8a8a8a' }}>Head to the Mint Page to link to Magic Eden, or Mint an Ol' Rusty - whilst stocks last.</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          🎮 HOW TO PLAY
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>1. Get a MineCart:</strong> Own a Pick NFT from The Mine collection, or mint Ol' Rusty</p>
          <p><strong>2. Connect Wallet:</strong> Use CONNECT button (Glyph or WalletConnect)</p>
          <p><strong>3. Select MineCart:</strong> Load your MineCart into the MineBoy</p>
          <p><strong>4. Start Mining:</strong> Press A button to begin SHA256 mining</p>
          <p><strong>5. Find Valid Hash:</strong> Mine until you find a hash with the required suffix</p>
          <p><strong>6. Claim Rewards:</strong> Press 'CLAIM' on the popup (or press B to reopen). You have 2 minutes after finding a valid hash to submit!</p>
          <p><strong>7. Mine Strategy:</strong> Better hashes = more MNESTR tokens. Chase rare suffixes for maximum rewards!</p>
          <p><strong>8. NPC Multiplier:</strong> Own 1+ Not a Punks Cult NFTs for a 1.2x reward multiplier on all claims!</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          ⚙️ CONTROLS
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>A Button:</strong> Start/Stop mining</p>
          <p><strong>B Button:</strong> Open claim overlay (hash found) or re-open if closed</p>
          <p><strong>D-Pad Left/Right:</strong> Switch between terminal and visualizer views</p>
          <p><strong>MENU Button:</strong> Open debug panel with stats and controls</p>
          <p><strong>Side Button (Left Edge):</strong> Eject cartridge and reset session - the classic "turn it off and on again" tech support solution!</p>
          <p><strong>Navigation:</strong> M=Mint, I=Info, L=Leaderboard (via top buttons)</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          💰 REWARD TIERS
        </h3>
        <div style={{
          fontSize: '11px',
          fontFamily: 'Menlo, monospace',
          color: '#c8ffc8',
          lineHeight: '1.6'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '45px 1fr 60px',
            gap: '4px',
            borderBottom: '1px solid #4a7d5f',
            paddingBottom: '4px',
            marginBottom: '6px',
            fontWeight: 'bold'
          }}>
            <div>HASH</div>
            <div>TIER NAME</div>
            <div style={{ textAlign: 'right' }}>MNESTR</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x0...</div><div>Hashalicious</div><div style={{ textAlign: 'right' }}>128</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x1...</div><div>Hashtalavista, Baby</div><div style={{ textAlign: 'right' }}>120</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x2...</div><div>Monster Mash</div><div style={{ textAlign: 'right' }}>112</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x3...</div><div>Magic Mix</div><div style={{ textAlign: 'right' }}>104</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x4...</div><div>Zesty Zap</div><div style={{ textAlign: 'right' }}>96</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x5...</div><div>Mythical Hash</div><div style={{ textAlign: 'right' }}>88</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x6...</div><div>Epic Hash</div><div style={{ textAlign: 'right' }}>80</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x7...</div><div>Hashtastic</div><div style={{ textAlign: 'right' }}>72</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x8...</div><div>Juicy Jolt</div><div style={{ textAlign: 'right' }}>64</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0x9...</div><div>Mega Hash</div><div style={{ textAlign: 'right' }}>56</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xa...</div><div>Great Hash</div><div style={{ textAlign: 'right' }}>48</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xb...</div><div>Solid Shard</div><div style={{ textAlign: 'right' }}>40</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xc...</div><div>Decent Drip</div><div style={{ textAlign: 'right' }}>32</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xd...</div><div>Basic Batch</div><div style={{ textAlign: 'right' }}>24</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xe...</div><div>Meh Hash</div><div style={{ textAlign: 'right' }}>16</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '45px 1fr 60px', gap: '4px' }}>
              <div>0xf...</div><div>Trash Hash</div><div style={{ textAlign: 'right' }}>8</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          🎯 DIFFICULTY & SUFFIXES
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>Suffix Mining:</strong> Find hashes ending with specific patterns (e.g., ...000000)</p>
          <p><strong>Variable Difficulty:</strong> Required suffix length adjusts based on active player count - more miners = harder difficulty</p>
          <p><strong>Rarity = Rewards:</strong> Rarer suffixes (0x0..., 0x1...) pay more MNESTR than common ones (0xe..., 0xf...)</p>
          <p><strong>Counter Windows:</strong> Each job gives you a specific range of nonces to search - no cherry-picking allowed!</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          💡 TIPS & INFO
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p>• <strong>Claim Fee:</strong> 0.01 APE per claim (distributed to Merchant, Flywheel, Team, and LP)</p>
          <p>• <strong>Job Timeout:</strong> Each mining job has a time limit based on difficulty and your MineCart speed</p>
          <p>• <strong>MineCart Limit:</strong> 3 per wallet (run 3 simultaneous mining sessions!)</p>
          <p>• <strong>Team Seasons:</strong> Choose a team and compete on leaderboards</p>
          <p>• <strong>Set Arcade Name:</strong> Personalize your miner name in the leaderboard</p>
          <p>• <strong>Anti-Cheat:</strong> Multiple security measures prevent botting and cheating (as best as possible)</p>
          <p>• <strong>Network:</strong> Powered by ApeCoin! on ApeChain!</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          🔒 SESSIONS & SECURITY
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>Session Limit:</strong> Up to 3 active sessions per wallet (one per MineCart)</p>
          <p><strong>Session Lock:</strong> One active session per MineCart prevents multi-window cheating</p>
          <p><strong>Heartbeat System:</strong> Backend validates your session every 30s to keep it alive</p>
          <p><strong>Job Timeout:</strong> Each mining job has a time limit based on difficulty and your MineCart's speed. Missing the deadline triggers a brief cooldown</p>
          <p><strong>Session Conflict:</strong> If your MineCart is locked by another session, use the Side Button to reset or wait for the session to expire</p>
          <p><strong>EIP-712 Signatures:</strong> Secure claim verification using cryptographic signatures</p>
          <p><strong>Rate Limiting:</strong> Anti-bot measures limit job requests and claim submissions</p>
          <p><strong>Physics Validation:</strong> Server validates mining speed and hash discovery timing</p>
          <p><strong>Work Binding:</strong> Mining jobs are cryptographically bound to your wallet and MineCart to prevent exploits</p>
        </div>
      </div>
    </div>
  );
}

// Welcome Content Component
function WelcomeContent({ onClose }: { onClose: () => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(SEASON_END_TIME - Date.now());

  const handleDontShowAgain = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mineboy_hideWelcome', 'true');
      setDontShowAgain(true);
      onClose();
    }
  };

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(SEASON_END_TIME - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
      {/* MineBoy Logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
        <img 
          src="/mineboylogo.png" 
          alt="MineBoy" 
          style={{ maxWidth: '200px', height: 'auto' }} 
        />
      </div>

      {/* Main Intro */}
      <div style={{
        padding: '20px',
        background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
        border: '3px solid #4a7d5f',
        borderRadius: '12px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#64ff8a' }}>
          Welcome to MineBoy
        </h3>
        <p style={{ fontSize: '16px', color: '#c8ffc8', lineHeight: '1.6', margin: '0' }}>
          Gamified cryptographic SHA256 mining.<br/>
          <span style={{ color: '#64ff8a', fontSize: '18px', fontWeight: 'bold' }}>MINE TO WIN!</span>
        </p>
      </div>

      {/* This Season's Prizes */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #2a1f3d, #1a0f2d)',
        border: '3px solid #9b59b6',
        borderRadius: '8px'
      }}>
        <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#e74c3c' }}>
          🏆 THIS SEASON'S PRIZES
        </h4>
        {/* Season countdown timer */}
        <div style={{ 
          marginBottom: '12px', 
          padding: '10px', 
          background: 'linear-gradient(180deg, #2d1f0f, #3d2a14)',
          borderRadius: '6px',
          border: '2px solid #ff8a00'
        }}>
          <div style={{ color: '#ffc864', fontSize: '11px', fontWeight: 'bold', marginBottom: 4 }}>
            ⏱️ SEASON 1 ENDS IN
          </div>
          <div style={{ color: '#ff8a00', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {formatTimeRemaining(timeRemaining)}
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#c8ffc8', lineHeight: '1.6', textAlign: 'left' }}>
          <p style={{ margin: '6px 0', color: '#f1c40f' }}>🥇 <strong>1st Place:</strong> Alpha Dog</p>
          <p style={{ margin: '6px 0', color: '#c0c0c0' }}>🥈 <strong>2nd Place:</strong> Eyeversed Blood of Ape</p>
          <p style={{ margin: '6px 0', color: '#cd7f32' }}>🥉 <strong>3rd Place:</strong> ApeDroidz</p>
        </div>
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          background: 'rgba(231, 76, 60, 0.2)', 
          borderRadius: '4px',
          border: '1px solid #e74c3c'
        }}>
          <p style={{ fontSize: '11px', color: '#ff8a8a', margin: 0, fontWeight: 'bold' }}>
            ⚠️ Only tokens you've MINED count as Score Tokens<br/>
            Buying the token won't improve your score!
          </p>
        </div>
      </div>

      {/* Navigation Guide */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #64ff8a',
        borderRadius: '8px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#64ff8a' }}>
          📍 NAVIGATION BUTTONS
        </h4>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '20px', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          {/* M Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
              color: '#c8ffc8',
              fontSize: '16px',
              fontWeight: 'bold',
              border: '2px solid #8a8a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              fontFamily: 'Menlo, monospace'
            }}>
              M
            </div>
            <span style={{ fontSize: '10px', color: '#8a8a8a' }}>Mint</span>
          </div>

          {/* I Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
              color: '#c8ffc8',
              fontSize: '16px',
              fontWeight: 'bold',
              border: '2px solid #8a8a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              fontFamily: 'Menlo, monospace'
            }}>
              I
            </div>
            <span style={{ fontSize: '10px', color: '#8a8a8a' }}>Information</span>
          </div>

          {/* L Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
              color: '#c8ffc8',
              fontSize: '16px',
              fontWeight: 'bold',
              border: '2px solid #8a8a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              fontFamily: 'Menlo, monospace'
            }}>
              L
            </div>
            <span style={{ fontSize: '10px', color: '#8a8a8a' }}>Leaderboard</span>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0, lineHeight: '1.4' }}>
          Use these buttons on the main screen to access different sections
        </p>
      </div>

      {/* Wallet Safety */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #2d1f0f, #3d2a14)',
        border: '2px solid #ff8a00',
        borderRadius: '8px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#ffc864' }}>
          🔐 WALLET SAFETY FIRST
        </h4>
        <p style={{ fontSize: '12px', color: '#c8a864', lineHeight: '1.5', marginBottom: '8px' }}>
          We recommend creating a new wallet for safety:
        </p>
        <div style={{ fontSize: '11px', color: '#c8a864', lineHeight: '1.4', textAlign: 'left' }}>
          <p style={{ margin: '4px 0' }}>📱 <strong>Mobile:</strong> Use Rabby Wallet's in-app browser</p>
          <p style={{ margin: '4px 0' }}>🔑 <strong>Easy Setup:</strong> Create wallet with Glyph (social login)</p>
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 138, 0, 0.3)' }}>
          <p style={{ fontSize: '12px', color: '#64ff8a', lineHeight: '1.5', marginBottom: '6px' }}>
            <strong>❄️ Cold Storage Option:</strong>
          </p>
          <p style={{ fontSize: '11px', color: '#c8a864', lineHeight: '1.4', marginBottom: '6px' }}>
            Keep your valuable NFTs in cold storage! Use <strong>delegate.xyz</strong> to mine from a hot wallet while your Picks and NPCs stay safe in your vault.
          </p>
          <div style={{ fontSize: '11px', color: '#8a8a8a', lineHeight: '1.4', textAlign: 'left' }}>
            <p style={{ margin: '4px 0' }}>✅ Hot wallet mines safely</p>
            <p style={{ margin: '4px 0' }}>✅ NFTs never leave cold storage</p>
            <p style={{ margin: '4px 0' }}>✅ Rewards go to you (hot wallet)</p>
            <p style={{ margin: '4px 0' }}>✅ NPC multipliers from vault</p>
          </div>
        </div>
      </div>

      {/* What You Need */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#64ff8a' }}>
          📋 WHAT YOU NEED
        </h4>
        <div style={{ fontSize: '12px', color: '#c8ffc8', lineHeight: '1.5', textAlign: 'left' }}>
          <p style={{ margin: '8px 0' }}>
            <strong>1. APE Tokens:</strong> For MINE TAX (0.001 APE) + gas per claim<br/>
            <span style={{ color: '#8a8a8a', fontSize: '11px' }}>1 APE ≈ 1000 claims</span>
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>2. MINE CART(s):</strong> FREE mint, up to 2 per wallet<br/>
            <span style={{ color: '#8a8a8a', fontSize: '11px' }}>Gas is sponsored!</span>
          </p>
        </div>
      </div>

      {/* Mine Tax Explanation */}
      <div style={{
        padding: '12px',
        background: 'rgba(74, 125, 95, 0.2)',
        border: '1px solid #4a7d5f',
        borderRadius: '6px'
      }}>
        <p style={{ fontSize: '11px', color: '#8a8a8a', lineHeight: '1.4', margin: 0 }}>
          💡 Mine Tax supports prize pools, team collection sweeps, and server costs
        </p>
      </div>

      {/* Don't Show Again */}
      <div style={{ marginTop: '8px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px', 
          cursor: 'pointer',
          fontSize: '12px',
          color: '#8a8a8a'
        }}>
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => {
              setDontShowAgain(e.target.checked);
              if (e.target.checked) {
                localStorage.setItem('mineboy_hideWelcome', 'true');
              } else {
                localStorage.removeItem('mineboy_hideWelcome');
              }
            }}
            style={{ cursor: 'pointer' }}
          />
          Don't show this message again
        </label>
      </div>

      {/* Close Button */}
      <button
        onClick={handleDontShowAgain}
        style={{
          padding: '12px 32px',
          background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
          color: '#c8ffc8',
          border: '2px solid #64ff8a',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'Menlo, monospace'
        }}
      >
        LET'S MINE! 🎮
      </button>
    </div>
  );
}
