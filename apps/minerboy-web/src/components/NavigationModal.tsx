'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { api } from '@/lib/api';
import { apiLeaderboardTeams } from '@/lib/api';
import TeamSelector from '@/components/TeamSelector';
import ArcadeNameSelector from '@/components/ArcadeNameSelector';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMintPrice } from '@/hooks/useMintPrice';
import { useSafeMint } from '@/hooks/useSafeMint';
import { useSpendChecks } from '@/hooks/useSpendChecks';
import { useContractState } from '@/hooks/useContractState';
import { formatEther } from 'viem';
import { EXPLORER_BASE, APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from "../lib/contracts";

type NavigationModalProps = {
  isOpen: boolean;
  page: 'leaderboard' | 'mint' | 'instructions' | null;
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
        </div>
      </div>
    </div>
  );
}

// Leaderboard Content Component
function LeaderboardContent() {
  const { address } = useAccount();
  
  // Debug logging
  useEffect(() => {
    console.log('[NavigationModal] LeaderboardContent rendering with address:', address?.slice(0, 8) + '...' + address?.slice(-6));
  }, [address]);
  const [period, setPeriod] = useState<'all'|'24h'|'7d'>('all');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.getLeaderboard({ period, limit: 25, ...(address ? { wallet: address } : {}) });
      setData(response);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period, address]);

  const formatUpdateTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const PERIODS: Array<'all'|'24h'|'7d'> = ['all','24h','7d'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#64ff8a', marginBottom: 4 }}>LEADERBOARD</h2>
        <div style={{ fontSize: 10, color: '#8a8a8a' }}>
          Updated {formatUpdateTime(data?.lastUpdated)} • next update ~{formatUpdateTime(data?.nextUpdate)}
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 12,
              fontFamily: 'monospace',
              cursor: 'pointer',
              background: period === p
                ? 'linear-gradient(145deg, #1a4d2a, #2d5a3d)'
                : 'linear-gradient(145deg, #0f2c1b, #1a3d24)',
              border: period === p ? '2px solid #64ff8a' : '2px solid #4a7d5f',
              color: period === p ? '#c8ffc8' : '#8a8a8a',
              boxShadow: period === p ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
              transition: 'all 0.1s ease'
            }}
          >
            {p.toUpperCase().replace('H', 'H')}
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
          <div>MINER</div>
          <div>TEAM</div>
          <div style={{ textAlign: 'right' }}>ABIT</div>
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

          {!loading && (!data?.entries || data.entries.length === 0) && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#8a8a8a',
              fontSize: '12px'
            }}>
              No entries yet.
            </div>
          )}
          
          {!loading && data?.entries?.map((e: any, index: number) => (
            <div 
              key={e.wallet} 
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1.4fr 0.8fr 100px',
                gap: '8px',
                padding: '8px 12px',
                borderBottom: index === (data.entries?.length || 0) - 1 ? 'none' : '1px solid #1a3d24',
                backgroundColor: index % 2 === 0 ? '#0f2c1b' : '#1a3d24',
                fontSize: '10px',
                color: '#c8ffc8',
                fontFamily: 'monospace'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{e.rank}</div>
              <div style={{
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {e.arcade_name ?? e.walletShort}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#64FF8A', 
                fontWeight: '700',
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
            gridTemplateColumns: '40px 1.4fr 0.8fr 100px',
            gap: '8px',
            padding: '8px 12px',
            fontSize: '10px',
            color: '#c8ffc8',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(45, 26, 15, 0.3)',
            borderRadius: '4px'
          }}>
            <div style={{ fontWeight: 'bold' }}>#{data.me.rank ?? '—'}</div>
            <div style={{
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {data.me.arcade_name ?? data.me.walletShort}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#64FF8A', 
              fontWeight: '700',
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
      <div style={{ marginTop: 24, width: '100%' }}>
        <TeamSelector />
      </div>

      {/* Arcade Name Selector */}
      <div style={{ marginTop: 16, width: '100%' }}>
        <ArcadeNameSelector />
      </div>

      {/* Team Standings */}
      <TeamStandings period={period} />
    </div>
  );
}

// Team Standings Component
function TeamStandings({ period }: { period: 'all' | '24h' | '7d' }) {
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

// Mint Content Component
function MintContent() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContract, isPending: isMinting, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  const [count] = useState(1); // Fixed to 1 cartridge
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const contractAddress = chainId ? CARTRIDGE_ADDRESSES[chainId] : null;
  const onApeChain = chainId === 33133;
  const onCurtis = chainId === 33111;
  const canMint = mounted && isConnected && contractAddress && (onApeChain || onCurtis);

  const { data: mintPrice, error: priceError, isLoading: priceLoading } = useMintPrice();
  const { simulate, mint, isReady, estTotal, value } = useSafeMint(count);

  if (!mounted) {
    return <div style={{ textAlign: 'center', color: '#8a8a8a' }}>Loading...</div>;
  }

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#8a8a8a', marginBottom: '16px' }}>
          Connect your wallet to mint cartridges
        </p>
      </div>
    );
  }

  if (!canMint) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#ff6b6b', marginBottom: '16px' }}>
          Please switch to ApeChain or Curtis to mint
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ color: '#64ff8a', marginBottom: '16px' }}>Mint Cartridges</h3>
      
      {priceLoading ? (
        <p style={{ color: '#8a8a8a' }}>Loading price...</p>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#c8ffc8', fontSize: '14px' }}>
            Price: {mintPrice ? formatEther(mintPrice) : '0'} APE
          </p>
        </div>
      )}

      <button
        onClick={mint}
        disabled={!isReady || isMinting || isConfirming}
        style={{
          padding: '12px 24px',
          borderRadius: '6px',
          background: isReady && !isMinting && !isConfirming 
            ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)'
            : 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
          color: '#c8ffc8',
          border: '2px solid #8a8a8a',
          cursor: isReady && !isMinting && !isConfirming ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {isMinting ? 'Minting...' : isConfirming ? 'Confirming...' : isConfirmed ? 'Minted!' : 'Mint'}
      </button>

      {hash && (
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#8a8a8a' }}>
          <a 
            href={`${EXPLORER_BASE}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#64ff8a', textDecoration: 'none' }}
          >
            View Transaction
          </a>
        </div>
      )}
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
          🎮 HOW TO PLAY
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>1. Connect Wallet:</strong> Use the CONNECT button to link your wallet</p>
          <p><strong>2. Select Cartridge:</strong> Choose an NFT cartridge to mine</p>
          <p><strong>3. Start Mining:</strong> Press the A button to begin mining</p>
          <p><strong>4. Find Hashes:</strong> Look for hashes ending in 0000</p>
          <p><strong>5. Claim Rewards:</strong> Submit successful hashes for ABIT tokens</p>
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
          <p><strong>B Button:</strong> Claim found hash</p>
          <p><strong>MENU:</strong> Open debug panel</p>
          <p><strong>Navigation:</strong> M=Mint, I=Info, L=Leaderboard</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          💡 TIPS
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p>• Higher hash rates increase your chances of finding valid hashes</p>
          <p>• Each cartridge has different mining parameters</p>
          <p>• Check the leaderboard to see top miners</p>
          <p>• Join a team for competitive mining seasons</p>
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
        border: '2px solid #4a7d5f',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#4a7d5f' }}>
          🔒 LOCK SYSTEM EXPLAINED
        </h3>
        <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#c8ffc8' }}>
          <p><strong>Ownership Lock (1h):</strong> Prevents cart flipping. New owner must wait 1h after transfer.</p>
          <p><strong>Session Lock (60s):</strong> One session per cartridge. Refreshed by heartbeats.</p>
          <p><strong>Wallet Limit:</strong> Max concurrent sessions per wallet (default: 10).</p>
          <p><strong>Graceful Recovery:</strong> Same wallet can resume after tab closure.</p>
        </div>
      </div>
    </div>
  );
}
