'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { apiListTeams, apiGetUserTeam, apiPickTeam, Team, apiGetArcadeName, apiSetArcadeName } from '@/lib/api';

function ConfirmJoinModal({
  team,
  loading,
  onConfirm,
  onCancel,
}: {
  team: Team;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const teamDisplayName = `${team.emoji ? `${team.emoji} ` : ''}${team.name}`;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            {teamDisplayName}
          </span>
          ?
          <br /><br />
          <span style={{ color: '#ffaa44', fontSize: 12 }}>
            You cannot change teams once selected!
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onConfirm}
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
            onClick={onCancel}
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
  );
}

export default function TeamSelector() {
  const { address } = useAccount();
  const [teams, setTeams] = useState<Team[]>([]);
  const [mine, setMine] = useState<Team | null>(null);
  const [pick, setPick] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      try {
        const [ts, me] = await Promise.all([
          apiListTeams(),
          apiGetUserTeam(address as `0x${string}`)
        ]);
        setTeams(ts ?? []);
        setMine(me.team ?? null);
        if (!me.team && ts && ts.length > 0) setPick(ts[0].slug);
      } catch (error) {
        console.error('Failed to fetch team data:', error);
        // Graceful fallback if backend routes aren't deployed yet
        setTeams([]);
      }
    };

    fetchData();
  }, [address]);

  const handleOpenConfirm = () => {
    if (!address || !pick || loading) return;
    const team = teams.find(t => t.slug === pick);
    if (team) {
      setConfirmTeam(team);
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTeam || !address) return;
    setLoading(true);
    try {
      const res = await apiPickTeam(address as `0x${string}`, confirmTeam.slug);
      setMine(res.team);
    } catch (e) {
      console.error('Failed to join team:', e);
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setConfirmTeam(null);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    setShowConfirm(false);
    setConfirmTeam(null);
  };

  if (!address) return null;

  return (
    <>
      {/* Fallback banner when teams aren't available */}
      {teams.length === 0 ? (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
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
            fontWeight: 800, color: '#8a8a8a',
            fontSize: 12, fontFamily: 'monospace'
          }}>
            Teams feature coming soon...
          </span>
        </div>
      ) : mine ? (
        // "Your Team" chip/banner
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
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
            fontWeight: 800, color: '#c8ffc8',
            fontSize: 12, fontFamily: 'monospace'
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
      ) : (
        // Picker + join button
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
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
        }}>
          <span style={{
            fontWeight: 800, color: '#c8ffc8',
            fontSize: 12, fontFamily: 'monospace'
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
            onClick={handleOpenConfirm}
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
      )}

      {/* Confirmation Modal (rendered alongside main UI) */}
      {showConfirm && confirmTeam && (
        <ConfirmJoinModal
          team={confirmTeam}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Arcade Name Section */}
      <ArcadeNameSelector />
    </>
  );
}

// Arcade Name Selector Component
function ArcadeNameSelector() {
  const { address } = useAccount();
  const [arcadeName, setArcadeName] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!address) return;
    
    // Load existing arcade name from backend
    const loadName = async () => {
      try {
        const result = await apiGetArcadeName(address);
        if (result.name) {
          setArcadeName(result.name);
        }
      } catch (e) {
        console.error('Failed to load arcade name:', e);
      }
    };
    
    loadName();
  }, [address]);

  const handleSubmit = async () => {
    if (!address || !inputValue.trim() || loading) return;
    
    const name = inputValue.trim().toUpperCase();
    
    // Validate length
    if (name.length > 8) {
      setError('Max 8 characters');
      return;
    }
    
    // Validate characters (alphanumeric and underscore only)
    if (!/^[A-Z0-9_]+$/.test(name)) {
      setError('Only A–Z, 0–9, _ allowed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiSetArcadeName(address, name);
      setArcadeName(name);
      setInputValue('');
    } catch (e: any) {
      if (e.message === 'taken') {
        setError('Name already taken');
      } else if (e.message === 'locked') {
        setError('You\'ve already set a name');
      } else {
        setError('Failed to save name');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!address) return null;

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: '#0f2c1b',
      border: '2px solid',
      borderTopColor: '#1a4d2a',
      borderLeftColor: '#1a4d2a',
      borderRightColor: '#3a8a4d',
      borderBottomColor: '#3a8a4d',
      borderRadius: 6,
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)',
      marginTop: 16
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 'bold',
        color: '#c8ffc8',
        marginBottom: 8,
        fontFamily: 'monospace'
      }}>
        ARCADE NAME
      </div>
      
      {arcadeName ? (
        // Show current name
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{
            padding: '8px 12px',
            border: '2px solid #4a7d5f',
            borderRadius: 6,
            color: '#64ff8a',
            background: '#1a2e1f',
            fontSize: 14,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            {arcadeName}
          </span>
          <span style={{
            fontSize: 10,
            color: '#8a8a8a',
            fontFamily: 'monospace'
          }}>
            (PERMANENT)
          </span>
        </div>
      ) : (
        // Show input form
        <div>
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 8
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                if (val.length <= 8) {
                  setInputValue(val);
                  setError('');
                }
              }}
              placeholder="ENTER NAME"
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#1a2e1f',
                border: '2px solid #4a7d5f',
                borderRadius: 4,
                color: '#c8ffc8',
                fontSize: 12,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '1px',
                outline: 'none'
              }}
              maxLength={8}
            />
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || loading}
              style={{
                padding: '8px 16px',
                backgroundColor: inputValue.trim() && !loading ? '#4a7d5f' : '#2a3d2f',
                border: '2px solid',
                borderTopColor: inputValue.trim() && !loading ? '#6a9d7f' : '#3a4d3f',
                borderLeftColor: inputValue.trim() && !loading ? '#6a9d7f' : '#3a4d3f',
                borderRightColor: inputValue.trim() && !loading ? '#2a5d3f' : '#1a2d1f',
                borderBottomColor: inputValue.trim() && !loading ? '#2a5d3f' : '#1a2d1f',
                borderRadius: 4,
                color: inputValue.trim() && !loading ? '#c8ffc8' : '#6a6a6a',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'SAVING...' : 'SET'}
            </button>
          </div>
          
          <div style={{
            fontSize: 10,
            color: '#8a8a8a',
            fontFamily: 'monospace',
            marginBottom: 4
          }}>
            8 chars max • Letters & numbers only • Permanent once set
          </div>
          
          {error && (
            <div style={{
              fontSize: 10,
              color: '#ff6b6b',
              fontFamily: 'monospace',
              fontWeight: 'bold'
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}