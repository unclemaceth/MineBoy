'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import ConnectButton from './ConnectButton';
import { LoginButton } from '@use-glyph/sdk-react';

export default function WalletConnectionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const [step, setStep] = useState<'choose' | 'glyph'>('choose');

  // Auto-close when wallet connects
  useEffect(() => {
    if (isConnected && isOpen) {
      onClose();
    }
  }, [isConnected, isOpen, onClose]);

  // Reset step when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('choose');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={backdrop}>
      <div style={sheet}>
        <div style={head}>
          <h2 style={{ margin: 0 }}>Connect Wallet</h2>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        {step === 'choose' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <ConnectButton label="Connect Wallet" />
            <button style={secondary} onClick={() => setStep('glyph')}>
              Glyph
            </button>
          </div>
        )}

        {step === 'glyph' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <button onClick={() => setStep('choose')} style={linkBtn}>← Back</button>
            <p style={{ opacity: .8, margin: 0 }}>Login with Glyph using your connected wallet:</p>
            <div style={{ padding: 12, border: '1px solid #333', borderRadius: 8 }}>
              <LoginButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = { 
  position:'fixed', 
  inset:0, 
  background:'rgba(0,0,0,.8)', 
  display:'flex', 
  alignItems:'center', 
  justifyContent:'center', 
  zIndex:1000, 
  padding:20 
};

const sheet: React.CSSProperties = { 
  width:'100%', 
  maxWidth:420, 
  background:'#141414', 
  color:'#fff', 
  border:'1px solid #2a2a2a', 
  borderRadius:12, 
  padding:16, 
  fontFamily:'monospace' 
};

const head: React.CSSProperties = { 
  display:'flex', 
  alignItems:'center', 
  justifyContent:'space-between', 
  marginBottom:12 
};

const xBtn: React.CSSProperties = { 
  background:'none', 
  border:'none', 
  color:'#888', 
  fontSize:20, 
  cursor:'pointer' 
};

const secondary: React.CSSProperties = { 
  height:48, 
  borderRadius:12, 
  border:'1px solid #333', 
  background:'#222', 
  color:'#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600
};

const linkBtn: React.CSSProperties = { 
  background:'none', 
  border:'none', 
  color:'#9cf', 
  textAlign:'left', 
  cursor:'pointer' 
};