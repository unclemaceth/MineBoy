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
      }
    };
    
    fetchData();
  }, [address]);

  const handleJoinTeam = async () => {
    if (!pick || !address || loading) return;
    
    setLoading(true);
    try {
      const res = await apiPickTeam(address as `0x${string}`, pick);
      setMine(res.team);
    } catch (error) {
      console.error('Failed to join team:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!address) return null;

  if (mine) {
    return (
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#1a2e1f',
        border: '2px solid #4a7d5f',
        borderRadius: 8,
        marginBottom: 16
      }}>
        <span style={{ 
          fontWeight: 800, 
          color: '#64ff8a',
          fontSize: 14,
          fontFamily: 'Menlo, monospace'
        }}>
          Your Team:
        </span>
        <span style={{
          padding: '8px 12px', 
          border: '2px solid #4a7d5f', 
          borderRadius: 6,
          color: '#64ff8a', 
          background: '#2a4a3d',
          fontSize: 14,
          fontFamily: 'Menlo, monospace',
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
      backgroundColor: '#1a2e1f',
      border: '2px solid #4a7d5f',
      borderRadius: 8,
      marginBottom: 16,
      flexWrap: 'wrap'
    }}>
      <span style={{ 
        fontWeight: 800, 
        color: '#64ff8a',
        fontSize: 14,
        fontFamily: 'Menlo, monospace'
      }}>
        Choose Team:
      </span>
      
      <select
        value={pick}
        onChange={e => setPick(e.target.value)}
        style={{ 
          padding: '8px 12px', 
          borderRadius: 6,
          backgroundColor: '#2a4a3d',
          color: '#64ff8a',
          border: '2px solid #4a7d5f',
          fontSize: 14,
          fontFamily: 'Menlo, monospace',
          minWidth: 200
        }}
      >
        {teams.map(t => (
          <option key={t.slug} value={t.slug} style={{ backgroundColor: '#2a4a3d', color: '#64ff8a' }}>
            {(t.emoji ? `${t.emoji} ` : '') + t.name}
          </option>
        ))}
      </select>
      
      <button
        onClick={handleJoinTeam}
        disabled={loading || !pick}
        style={{ 
          padding: '8px 16px', 
          borderRadius: 6, 
          fontWeight: 700,
          backgroundColor: loading ? '#4a7d5f' : '#64ff8a',
          color: loading ? '#fff' : '#2a4a3d',
          border: '2px solid #4a7d5f',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontFamily: 'Menlo, monospace',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Joining...' : 'Join Team'}
      </button>
    </div>
  );
}
