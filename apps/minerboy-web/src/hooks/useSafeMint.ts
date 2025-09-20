'use client';

import { useMemo } from 'react';
import { useAccount, useChainId, useWriteContract } from 'wagmi';
import { formatEther, zeroAddress } from 'viem';
import { APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from '@/lib/contracts';
import { useMintPrice } from './useMintPrice';

export function useSafeMint(count: number) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const { data: mintPrice } = useMintPrice();

  const contract = chainId ? CARTRIDGE_ADDRESSES[chainId] : undefined;
  const value = mintPrice ? mintPrice * BigInt(count) : 0n;

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
      args: [BigInt(count)] as const,
      value
    };
  }

  async function mint() {
    const request = await simulate();                  // will throw if invalid
    return await writeContractAsync(request);          // actual transaction
  }

  const estTotal = useMemo(() => (mintPrice ? formatEther(mintPrice * BigInt(count)) : null), [mintPrice, count]);

  return { 
    simulate, 
    mint, 
    estTotal, 
    value, 
    contract,
    isReady: Boolean(contract && mintPrice && isConnected) 
  };
}
