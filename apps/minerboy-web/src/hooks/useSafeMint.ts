'use client';

import { useMemo } from 'react';
import { useChainId, useWriteContract } from 'wagmi';
import { formatEther, zeroAddress } from 'viem';
import { APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from '@/lib/contracts';
import { useMintPrice } from './useMintPrice';
import { useActiveAccount } from './useActiveAccount';

export function useSafeMint(count: number) {
  const { isConnected, address } = useActiveAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { data: mintPrice } = useMintPrice();

  const contract = chainId ? CARTRIDGE_ADDRESSES[chainId] : undefined;
  const value = mintPrice || 0n; // Single mint price (no quantity multiplier)

  async function simulate() {
    if (!isConnected || !address) throw new Error('Connect your wallet');
    if (!contract || contract === zeroAddress) throw new Error('Mint contract unavailable on this chain');
    if (!mintPrice || mintPrice <= 0n) throw new Error('Mint price unavailable');

    console.log('[Mint preflight]', {
      chainId, 
      contract, 
      qty: count,
      mintPrice: mintPrice?.toString(),
      valueWei: value.toString(),
      address
    });

    // For now, just validate the inputs - the actual simulation will happen in mint()
    return {
      address: contract,
      abi: APEBIT_CARTRIDGE_ABI,
      functionName: 'mint' as const,
      args: [address] as const, // mint(address to) - recipient address
      value
    };
  }

  async function mint() {
    const request = await simulate();                  // will throw if invalid
    return await writeContractAsync(request);          // actual transaction
  }

  const estTotal = useMemo(() => (mintPrice ? formatEther(mintPrice) : null), [mintPrice]);

  return { 
    simulate, 
    mint, 
    estTotal, 
    value, 
    contract,
    isReady: Boolean(contract && mintPrice && isConnected) 
  };
}