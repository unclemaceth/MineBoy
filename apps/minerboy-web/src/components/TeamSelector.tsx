'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { apiListTeams, apiGetUserTeam, apiPickTeam, Team } from '@/lib/api';

export default function TeamSelector() {
  const { address } = useAccount();
  const [teams, setTeams] = useState<Team[]>([]);
  const [mine, setMine] = useState<Team | null>(null);
  const [pick, setPick] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!address) return;
    
    const fetchData = async () => {
      try {
        const [ts, me] = await Promise.all([
          apiListTeams(),
          apiGetUserTeam(address as `0x${string}`)
        ]);
        setTeams(ts);
        setMine(me.team);
        if (!me.team && ts[0]) setPick(ts[0].slug);
      } catch (error) {
        console.error('Failed to fetch team data:', error);
        // If teams endpoint is not available (404), show a fallback message
        if (error instanceof Error && error.message.includes('Failed to fetch teams')) {
          setTeams([]); // Empty teams array will show "Teams not available"
        }
      }
    };
    
    fetchData();
  }, [address]);

  const handleJoinTeam = () => {
    if (!pick || !address || loading) return;
    
    const team = teams.find(t => t.slug === pick);
    if (team) {
      setSelectedTeam(team);
      setShowConfirm(true);
    }
  };

  const confirmJoinTeam = async () => {
    if (!selectedTeam || !address) return;
    
    setLoading(true);
    setShowConfirm(false);
    try {
      const res = await apiPickTeam(address as `0x${string}`, selectedTeam.slug);
      setMine(res.team);
    } catch (error) {
      console.error('Failed to join team:', error);
    } finally {
      setLoading(false);
      setSelectedTeam(null);
    }
  };

  if (!address) return null;

  // Show fallback message when teams aren't available
  if (teams.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#0f2c1b',
        border: '2px solid',
        borderTopColor: '#1a4d2a',
        borderLeftColor: '#1a4d2a',
        borderRightColor: '#3a8a4d',
        borderBottomColor: '#3a8a4d',
        borderRadius: 6,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
        marginBottom: 16
      }}>
        <span style={{ 
          fontWeight: 800, 
          color: '#8a8a8a',
          fontSize: 12,
          fontFamily: 'monospace'
        }}>
          Teams feature coming soon...
        </span>
      </div>
    );
  }

  if (mine) {
    return (
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#0f2c1b',
        border: '2px solid',
        borderTopColor: '#1a4d2a',
        borderLeftColor: '#1a4d2a',
        borderRightColor: '#3a8a4d',
        borderBottomColor: '#3a8a4d',
        borderRadius: 6,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
        marginBottom: 16
      }}>
        <span style={{ 
          fontWeight: 800, 
          color: '#c8ffc8',
          fontSize: 12,
          fontFamily: 'monospace'
        }}>
          Your Team:
        </span>
        <span style={{
          padding: '8px 12px', 
          border: '2px solid #4a7d5f', 
          borderRadius: 6,
          color: '#c8ffc8', 
          background: '#1a2e1f',
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 'bold'
        }}>
          {mine.emoji ? `${mine.emoji} ` : ''}{mine.name}
        </span>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: 12, 
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: '#0f2c1b',
      border: '2px solid',
      borderTopColor: '#1a4d2a',
      borderLeftColor: '#1a4d2a',
      borderRightColor: '#3a8a4d',
      borderBottomColor: '#3a8a4d',
      borderRadius: 6,
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
      marginBottom: 16,
      flexWrap: 'wrap'
    }}>
      <span style={{ 
        fontWeight: 800, 
        color: '#c8ffc8',
        fontSize: 12,
        fontFamily: 'monospace'
      }}>
        Choose Team:
      </span>
      
      <select
        value={pick}
        onChange={e => setPick(e.target.value)}
        style={{ 
          padding: '8px 12px', 
          borderRadius: 6,
          backgroundColor: '#1a2e1f',
          color: '#c8ffc8',
          border: '2px solid #4a7d5f',
          fontSize: 12,
          fontFamily: 'monospace',
          minWidth: 200
        }}
      >
        {teams.map(t => (
          <option key={t.slug} value={t.slug} style={{ backgroundColor: '#1a2e1f', color: '#c8ffc8' }}>
            {(t.emoji ? `${t.emoji} ` : '') + t.name}
          </option>
        ))}
      </select>
      
      <button
        onClick={handleJoinTeam}
        disabled={loading || !pick}
        style={{ 
          background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
          border: '2px solid #8a8a8a',
          borderRadius: 6,
          color: '#c8ffc8',
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 'bold',
          fontFamily: 'monospace',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          transition: 'all 0.1s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {loading ? 'Joining...' : 'Join Team'}
      </button>
    </div>
  );

  // Confirmation Modal
  if (showConfirm && selectedTeam) {
    return (
      <>
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#0f2c1b',
          border: '2px solid',
          borderTopColor: '#1a4d2a',
          borderLeftColor: '#1a4d2a',
          borderRightColor: '#3a8a4d',
          borderBottomColor: '#3a8a4d',
          borderRadius: 6,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
          marginBottom: 16,
          flexWrap: 'wrap'
        }}>
          <span style={{ 
            fontWeight: 800, 
            color: '#c8ffc8',
            fontSize: 12,
            fontFamily: 'monospace'
          }}>
            Choose Team:
          </span>
          
          <select
            value={pick}
            onChange={e => setPick(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 6,
              backgroundColor: '#1a2e1f',
              color: '#c8ffc8',
              border: '2px solid #4a7d5f',
              fontSize: 12,
              fontFamily: 'monospace',
              minWidth: 200
            }}
          >
            {teams.map(t => (
              <option key={t.slug} value={t.slug} style={{ backgroundColor: '#1a2e1f', color: '#c8ffc8' }}>
                {(t.emoji ? `${t.emoji} ` : '') + t.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={handleJoinTeam}
            disabled={loading || !pick}
            style={{ 
              background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
              border: '2px solid #8a8a8a',
              borderRadius: 6,
              color: '#c8ffc8',
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              transition: 'all 0.1s ease'
            }}
          >
            {loading ? 'Joining...' : 'Join Team'}
          </button>
        </div>

        {/* Confirmation Modal */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#0f2c1b',
            border: '2px solid',
            borderTopColor: '#1a4d2a',
            borderLeftColor: '#1a4d2a',
            borderRightColor: '#3a8a4d',
            borderBottomColor: '#3a8a4d',
            borderRadius: 6,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
            padding: 24,
            maxWidth: 320,
            width: '90%',
            textAlign: 'center',
          }}>
            <div style={{
              color: '#c8ffc8',
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 16,
              fontFamily: 'monospace',
            }}>
              ⚠️ TEAM CHOICE IS FINAL
            </div>
            <div style={{
              color: '#c8ffc8',
              fontSize: 14,
              marginBottom: 24,
              fontFamily: 'monospace',
            }}>
              Are you sure you want to join{' '}
              <span style={{ fontWeight: 'bold', color: '#64ff8a' }}>
                {selectedTeam.emoji ? `${selectedTeam.emoji} ` : ''}{selectedTeam.name}
              </span>?
              <br />
              <br />
              <span style={{ color: '#ffaa44', fontSize: 12 }}>
                You cannot change teams once selected!
              </span>
            </div>
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
            }}>
              <button
                onClick={confirmJoinTeam}
                disabled={loading}
                style={{
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '2px solid #8a8a8a',
                  borderRadius: 6,
                  color: '#c8ffc8',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {loading ? 'Joining...' : 'YES, JOIN TEAM'}
              </button>
              
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setSelectedTeam(null);
                }}
                disabled={loading}
                style={{
                  background: 'linear-gradient(145deg, #2d1a0f, #1a0f0a)',
                  border: '2px solid #8a8a8a',
                  borderRadius: 6,
                  color: '#c8ffc8',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
}
