'use client';
import { useWalletModal } from '@/state/walletModal';

export default function OpenConnectModalButton({ 
  label = 'Connect Wallet' 
}: { 
  label?: string; 
}) {
  const { open } = useWalletModal();
  
  return (
    <button 
      onClick={open} 
      style={{ 
        height: 48, 
        borderRadius: 12, 
        fontWeight: 700,
        background: '#00ff88',
        color: '#000',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '0 24px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#00cc6a';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#00ff88';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {label}
    </button>
  );
}
