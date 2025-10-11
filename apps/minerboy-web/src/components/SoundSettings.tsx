'use client';

import { useState, useEffect } from 'react';
import { soundManager } from '@/lib/sounds';

export default function SoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [buttonSoundsEnabled, setButtonSoundsEnabled] = useState(true);
  const [claimSoundsEnabled, setClaimSoundsEnabled] = useState(true);
  const [failSoundsEnabled, setFailSoundsEnabled] = useState(true);
  const [miningSoundsEnabled, setMiningSoundsEnabled] = useState(true);
  
  useEffect(() => {
    setSoundEnabled(soundManager.isEnabled());
    setButtonSoundsEnabled(soundManager.isButtonSoundsEnabled());
    setClaimSoundsEnabled(soundManager.isClaimSoundsEnabled());
    setFailSoundsEnabled(soundManager.isFailSoundsEnabled());
    setMiningSoundsEnabled(soundManager.isMiningSoundsEnabled());
  }, []);
  
  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    soundManager.setEnabled(enabled);
    
    // Play test sound when enabling
    if (enabled) {
      soundManager.playButtonSound();
    }
  };
  
  const handleToggleButtonSounds = (enabled: boolean) => {
    setButtonSoundsEnabled(enabled);
    soundManager.setButtonSoundsEnabled(enabled);
    
    // Play test sound when enabling
    if (enabled && soundEnabled) {
      soundManager.playButtonSound();
    }
  };
  
  const handleToggleClaimSounds = (enabled: boolean) => {
    setClaimSoundsEnabled(enabled);
    soundManager.setClaimSoundsEnabled(enabled);
    
    // Play test sound when enabling
    if (enabled && soundEnabled) {
      soundManager.playConfirmSound();
    }
  };
  
  const handleToggleFailSounds = (enabled: boolean) => {
    setFailSoundsEnabled(enabled);
    soundManager.setFailSoundsEnabled(enabled);
    
    // Play test sound when enabling
    if (enabled && soundEnabled) {
      soundManager.playFailSound();
    }
  };
  
  const handleToggleMiningSounds = (enabled: boolean) => {
    setMiningSoundsEnabled(enabled);
    soundManager.setMiningSoundsEnabled(enabled);
    
    // Start/stop mining sound for testing
    if (enabled && soundEnabled) {
      soundManager.startMiningSound('test-preview');
      setTimeout(() => soundManager.stopMiningSound('test-preview'), 1000);
    } else {
      // Stop ALL mining sounds when toggling off
      soundManager.stopAllMiningSounds();
    }
  };
  
  const ToggleSwitch = ({ enabled, onChange, disabled = false }: { enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) => (
    <label style={{
      position: 'relative',
      display: 'inline-block',
      width: '44px',
      height: '24px',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        style={{
          opacity: 0,
          width: 0,
          height: 0
        }}
      />
      <span style={{
        position: 'absolute',
        cursor: disabled ? 'not-allowed' : 'pointer',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: enabled ? '#4a7d5f' : '#4a4a4a',
        borderRadius: '24px',
        transition: '0.3s',
        border: '2px solid #8a8a8a'
      }}>
        <span style={{
          position: 'absolute',
          content: '""',
          height: '16px',
          width: '16px',
          left: enabled ? '22px' : '2px',
          bottom: '2px',
          backgroundColor: '#c8ffc8',
          borderRadius: '50%',
          transition: '0.3s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }} />
      </span>
    </label>
  );

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid #4a7d5f',
      marginBottom: '16px'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#c8ffc8',
        marginBottom: '16px'
      }}>
        SOUND SETTINGS
      </div>
      
      {/* Master Sound Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          fontWeight: 'bold'
        }}>
          Master Sound
        </span>
        <ToggleSwitch enabled={soundEnabled} onChange={handleToggleSound} />
      </div>
      
      {/* Button Sounds */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          opacity: 0.8
        }}>
          Button Sounds
        </span>
        <ToggleSwitch enabled={buttonSoundsEnabled} onChange={handleToggleButtonSounds} disabled={!soundEnabled} />
      </div>
      
      {/* Claim Sounds */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          opacity: 0.8
        }}>
          Claim Sounds (Success)
        </span>
        <ToggleSwitch enabled={claimSoundsEnabled} onChange={handleToggleClaimSounds} disabled={!soundEnabled} />
      </div>
      
      {/* Fail Sounds */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          opacity: 0.8
        }}>
          Error Sounds (Fail)
        </span>
        <ToggleSwitch enabled={failSoundsEnabled} onChange={handleToggleFailSounds} disabled={!soundEnabled} />
      </div>
      
      {/* Mining Sounds */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#c8ffc8',
          opacity: 0.8
        }}>
          Mining Sounds
        </span>
        <ToggleSwitch enabled={miningSoundsEnabled} onChange={handleToggleMiningSounds} disabled={!soundEnabled} />
      </div>
      
      <div style={{
        fontSize: '10px',
        color: '#c8ffc8',
        opacity: 0.6,
        lineHeight: '1.3',
        marginTop: '12px'
      }}>
        • Button sounds play on all interactions<br/>
        • Claim sounds play when hash found successfully<br/>
        • Error sounds play on failures and penalties<br/>
        • Mining sounds loop during active mining<br/>
        • Individual toggles disabled when master sound is off
      </div>
    </div>
  );
}