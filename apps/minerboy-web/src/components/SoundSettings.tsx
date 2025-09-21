'use client';

import { useState, useEffect } from 'react';
import { soundManager } from '@/lib/sounds';

export default function SoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  useEffect(() => {
    setSoundEnabled(soundManager.isEnabled());
  }, []);
  
  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    soundManager.setEnabled(enabled);
    
    // Play test sound when enabling
    if (enabled) {
      soundManager.playButtonSound();
    }
  };
  
  return (
    <div style={{
      padding: '16px',
      borderTop: '1px solid #4a7d5f',
      marginTop: '16px'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#c8ffc8',
        marginBottom: '12px'
      }}>
        AUDIO SETTINGS
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          opacity: 0.8
        }}>
          Sound Effects
        </span>
        
        <label style={{
          position: 'relative',
          display: 'inline-block',
          width: '44px',
          height: '24px'
        }}>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => handleToggleSound(e.target.checked)}
            style={{
              opacity: 0,
              width: 0,
              height: 0
            }}
          />
          <span style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: soundEnabled ? '#4a7d5f' : '#4a4a4a',
            borderRadius: '24px',
            transition: '0.3s',
            border: '2px solid #8a8a8a'
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '16px',
              width: '16px',
              left: soundEnabled ? '22px' : '2px',
              bottom: '2px',
              backgroundColor: '#c8ffc8',
              borderRadius: '50%',
              transition: '0.3s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
          </span>
        </label>
      </div>
      
      <div style={{
        fontSize: '10px',
        color: '#c8ffc8',
        opacity: 0.6,
        lineHeight: '1.3'
      }}>
        • Button sounds play on all interactions<br/>
        • Confirm sound plays when hash found<br/>
        • Mining sound loops during active mining<br/>
        • Haptic feedback on supported devices
      </div>
    </div>
  );
}
