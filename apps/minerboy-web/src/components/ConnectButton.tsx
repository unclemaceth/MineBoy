'use client';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { projectId } from '@/lib/wallet';

export default function ConnectButton({ variant = 'default' }: { variant?: 'default' | 'qr' }) {
  const { open } = useWeb3Modal();
  const disabled = !projectId;
  
  return (
    <button
      onClick={() => !disabled && open(variant === 'qr' ? { view: 'Connect' } : undefined)}
      disabled={disabled}
      className="btn"
      aria-label="Connect wallet"
      style={{
        height: '48px',
        padding: '0 16px',
        borderRadius: '12px',
        fontSize: '16px',
        backgroundColor: '#64ff8a',
        border: '2px solid #64ff8a',
        color: '#000',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
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
      title={disabled ? 'WalletConnect not configured' : 'Connect wallet'}
    >
      {variant === 'qr' ? 'WalletConnect (QR)' : 'Connect Wallet'}
    </button>
  );
}
