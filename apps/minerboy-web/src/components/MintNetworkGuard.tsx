'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { curtis, apechain } from '@/lib/wallet';
import OpenConnectModalButton from './OpenConnectModalButton';

export default function MintNetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) return <OpenConnectModalButton />;

  const allowed = [curtis.id, apechain.id] as const;
  const wrong = chainId !== undefined && !allowed.includes(chainId as any);

  if (!wrong) return null;

  return (
    <div className="grid gap-2">
      <button 
        onClick={() => switchChain({ chainId: apechain.id })}
        className="h-10 rounded-lg bg-amber-400 px-4 font-medium text-black hover:brightness-95"
      >
        Switch to ApeChain
      </button>
      <button 
        onClick={() => switchChain({ chainId: curtis.id })}
        className="h-10 rounded-lg bg-amber-400 px-4 font-medium text-black hover:brightness-95"
      >
        Switch to Curtis
      </button>
    </div>
  );
}
