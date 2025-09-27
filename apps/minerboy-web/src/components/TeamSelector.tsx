'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { apiListTeams, apiGetUserTeamChoice, apiChooseTeam, apiGetNameNonce, Team } from '@/lib/api';

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
            <br />
            Requires wallet signature to confirm.
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
  const [myTeamChoice, setMyTeamChoice] = useState<{ chosen: boolean; team_slug?: string; season?: any } | null>(null);
  const [pick, setPick] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasActiveTeamSeason, setHasActiveTeamSeason] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      try {
        const [ts, teamChoice] = await Promise.all([
          apiListTeams(),
          apiGetUserTeamChoice(address as `0x${string}`)
        ]);
        setTeams(ts ?? []);
        setMyTeamChoice(teamChoice);
        setHasActiveTeamSeason(!!teamChoice.season);
        
        // If no team chosen and teams available, select first one
        if (!teamChoice.chosen && ts && ts.length > 0) {
          setPick(ts[0].slug);
        }
      } catch (error) {
        console.error('Failed to fetch team data:', error);
        // Graceful fallback if backend routes aren't deployed yet
        setTeams([]);
        setHasActiveTeamSeason(false);
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
      // Get nonce for signature
      const { nonce } = await apiGetNameNonce(address);
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      // Build message for signature
      const message = `MineBoy: choose team
Wallet: ${address}
Team: ${confirmTeam.slug}
Nonce: ${nonce}
Expires: ${expiry}`;
      
      // Request signature from wallet
      if (!window.ethereum) {
        throw new Error('No wallet connected');
      }
      const sig = await (window.ethereum as any).request({
        method: 'personal_sign',
        params: [message, address],
      });
      
      // Choose team with signature
      const res = await apiChooseTeam(address as `0x${string}`, confirmTeam.slug, nonce, expiry, sig);
      
      console.log(`Successfully joined team ${res.team_slug}, attributed ${res.attributed_claims} claims`);
      
      // Update local state directly (like ArcadeNameSelector does)
      setMyTeamChoice({
        chosen: true,
        team_slug: res.team_slug,
        season: { slug: res.season_slug, id: res.season_id }
      });
      setHasActiveTeamSeason(true);
      
      // Close modal after successful team selection
      setShowConfirm(false);
      setConfirmTeam(null);
    } catch (e: any) {
      console.error('Failed to join team:', e);
      if (e.message === 'User rejected the request') {
        // User cancelled signature - don't show error
        console.log('Team selection cancelled by user');
      } else if (e.message === 'already_chosen') {
        // Refresh team choice state
        try {
          const teamChoice = await apiGetUserTeamChoice(address as `0x${string}`);
          setMyTeamChoice(teamChoice);
        } catch (refreshError) {
          console.error('Failed to refresh team choice:', refreshError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    setShowConfirm(false);
    setConfirmTeam(null);
  };

  if (!address) return null;

  // Get the chosen team info
  const myTeam = myTeamChoice?.chosen && myTeamChoice?.team_slug 
    ? teams.find(t => t.slug === myTeamChoice.team_slug)
    : null;

  return (
    <>
      {/* Fallback banner when teams aren't available or no active team season */}
      {teams.length === 0 || !hasActiveTeamSeason ? (
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
            {!hasActiveTeamSeason ? 'No active team season' : 'Teams feature coming soon...'}
          </span>
        </div>
      ) : myTeam ? (
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
            {myTeam.emoji ? `${myTeam.emoji} ` : ''}{myTeam.name}
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

    </>
  );
}