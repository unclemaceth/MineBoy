'use client';
import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { apiGetArcadeName, apiGetNameNonce, apiSetArcadeName } from '@/lib/api';

export default function ArcadeNameSelector() {
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
      // Get nonce from backend
      const { nonce } = await apiGetNameNonce(address);
      
      // Create expiry (10 minutes from now)
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      // Build message for signing
      const message = `MineBoy: set arcade name
Wallet: ${address}
Name: ${name}
Nonce: ${nonce}
Expires: ${expiry}`;
      
      // Sign the message
      if (!window.ethereum) {
        throw new Error('No wallet connected');
      }
      const sig = await (window.ethereum as any).request({
        method: 'personal_sign',
        params: [message, address],
      });
      
      // Submit to backend
      await apiSetArcadeName(address, name, nonce, expiry, sig);
      setArcadeName(name);
      setInputValue('');
    } catch (e: any) {
      if (e.message === 'taken') {
        setError('Name already taken');
      } else if (e.message === 'locked') {
        setError('You\'ve already set a name');
      } else if (e.message === 'User rejected the request') {
        setError('Signature cancelled');
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
            8 chars max • Letters & numbers only • Permanent once set • Requires wallet signature
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
