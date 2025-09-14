import { useMinerStore } from '@/state/miner';
import { useState } from 'react';

export default function ClaimOverlay() {
  const { foundHash, setFoundHash, pushLine, setMiningState } = useMinerStore();
  const [isSimulating, setIsSimulating] = useState(false);

  if (!foundHash) return null;

  const handleSimulate = async () => {
    setIsSimulating(true);
    setMiningState('claiming');
    
    // Mock verification steps
    pushLine('Starting claim verification...');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    pushLine('Wallet Match: ✅ YES');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    pushLine('PrevHash Match: ✅ YES');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    pushLine('Contract Simulation: ✅ SUCCESS');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    pushLine('Tx confirmed (mock).');
    
    setIsSimulating(false);
    setFoundHash(null);
    setMiningState('idle'); // Return to idle, user must press A to resume
  };

  const handleDismiss = () => {
    setFoundHash(null);
    setMiningState('idle'); // Return to idle, user must press A to resume
  };

  return (
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
        backgroundColor: '#2a4a3d',
        border: '3px solid #4a7d5f',
        borderRadius: 12,
        padding: 24,
        maxWidth: 320,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
        }}>
          Hash Found! 🎉
        </div>
        
        <div style={{
          color: '#64ff8a',
          fontSize: 12,
          fontFamily: 'Menlo, monospace',
          marginBottom: 24,
          wordBreak: 'break-all',
          opacity: 0.8,
        }}>
          {foundHash.slice(0, 20)}...{foundHash.slice(-10)}
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
        }}>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid',
              borderTopColor: '#4a7d5f',
              borderLeftColor: '#4a7d5f',
              borderRightColor: '#1a3d24',
              borderBottomColor: '#1a3d24',
              background: 'linear-gradient(145deg, #3a6a4d, #2a4a3d)',
              color: '#64ff8a',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: isSimulating ? 'not-allowed' : 'pointer',
              opacity: isSimulating ? 0.6 : 1,
              fontFamily: 'Menlo, monospace',
            }}
          >
            {isSimulating ? 'Simulating...' : 'Simulate'}
          </button>
          
          <button
            onClick={handleDismiss}
            disabled={isSimulating}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid',
              borderTopColor: '#666',
              borderLeftColor: '#666',
              borderRightColor: '#333',
              borderBottomColor: '#333',
              background: 'linear-gradient(145deg, #555, #333)',
              color: '#ccc',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: isSimulating ? 'not-allowed' : 'pointer',
              opacity: isSimulating ? 0.6 : 1,
              fontFamily: 'Menlo, monospace',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
