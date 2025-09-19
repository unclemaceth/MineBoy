'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { APECHAIN, CURTIS } from '@/lib/wallet';

export default function NetworkSwitcher() {
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  return (
    <div style={{ display:'flex', gap:8, flexWrap: 'wrap' }}>
      <button 
        disabled={isPending || chainId === APECHAIN.id} 
        onClick={() => switchChain({ chainId: APECHAIN.id })}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #333',
          background: chainId === APECHAIN.id ? '#00ff88' : '#222',
          color: chainId === APECHAIN.id ? '#000' : '#fff',
          cursor: chainId === APECHAIN.id ? 'default' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          opacity: isPending ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        {chainId === APECHAIN.id ? 'On ApeChain' : 'Switch to ApeChain'}
      </button>
      
      <button 
        disabled={isPending || chainId === CURTIS.id} 
        onClick={() => switchChain({ chainId: CURTIS.id })}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #333',
          background: chainId === CURTIS.id ? '#00ff88' : '#222',
          color: chainId === CURTIS.id ? '#000' : '#fff',
          cursor: chainId === CURTIS.id ? 'default' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          opacity: isPending ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        {chainId === CURTIS.id ? 'On Curtis' : 'Switch to Curtis'}
      </button>
    </div>
  );
}
