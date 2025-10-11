'use client';
import { useActiveAccount } from '@/hooks/useActiveAccount';

export default function DebugWalletBadge() {
  const { address, provider, isConnected } = useActiveAccount();
  
  if (process.env.NODE_ENV === 'production') return null;
  
  return (
    <div className="fixed bottom-2 right-2 z-[9999] rounded bg-black/70 px-2 py-1 text-xs text-white font-mono">
      {isConnected ? (
        <>
          <span className="text-green-400">{provider}</span>
          {': '}
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </>
      ) : (
        <span className="text-red-400">disconnected</span>
      )}
    </div>
  );
}

