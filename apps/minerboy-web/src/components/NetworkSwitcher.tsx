'use client';
import { useChainId, useSwitchChain } from 'wagmi';

export const APECHAIN = 33139 as const;
export const CURTIS  = 33111 as const;

export default function NetworkSwitcher({ target = APECHAIN }:{ target?: number }) {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!chainId || chainId === target) return null;

  const label = target === APECHAIN ? 'Switch to ApeChain' : 'Switch to Curtis';

  return (
    <button
      disabled={isPending}
      onClick={() => switchChain({ chainId: target })}
      className="h-10 rounded-lg bg-amber-400 px-4 font-medium text-black hover:brightness-95"
    >
      {label}
    </button>
  );
}