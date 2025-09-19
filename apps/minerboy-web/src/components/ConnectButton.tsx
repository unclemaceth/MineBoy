'use client';
import { projectId } from '@/lib/wallet';
import { useWeb3Modal } from '@web3modal/wagmi/react';

export default function ConnectButton({ variant = 'default' }: { variant?: 'default' | 'qr' }) {
  const disabled = !projectId;

  // Early return avoids calling the hook when modal isn't created
  if (disabled) {
    return (
      <button
        disabled
        style={{ 
          height: 48, 
          padding: '0 16px', 
          borderRadius: 12, 
          fontSize: 16, 
          opacity: 0.6,
          backgroundColor: '#64ff8a',
          border: '2px solid #64ff8a',
          color: '#000',
          fontWeight: 'bold',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        title="WalletConnect not configured"
      >
        {variant === 'qr' ? 'WalletConnect (QR)' : 'Connect Wallet'}
      </button>
    );
  }

  const { open } = useWeb3Modal();
  return (
    <button
      onClick={() => open(variant === 'qr' ? { view: 'Connect' } : undefined)}
      style={{ 
        height: 48, 
        padding: '0 16px', 
        borderRadius: 12, 
        fontSize: 16, 
        fontWeight: 700,
        backgroundColor: '#64ff8a',
        border: '2px solid #64ff8a',
        color: '#000',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = '#55e577';
        e.currentTarget.style.borderColor = '#55e577';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = '#64ff8a';
        e.currentTarget.style.borderColor = '#64ff8a';
      }}
      title="Connect wallet"
    >
      {variant === 'qr' ? 'WalletConnect (QR)' : 'Connect Wallet'}
    </button>
  );
}
