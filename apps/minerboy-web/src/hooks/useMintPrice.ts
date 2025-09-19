'use client';

import { useChainId, useReadContract } from 'wagmi';
import { APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from '@/lib/contracts';

export function useMintPrice() {
  const chainId = useChainId();
  const address = chainId ? CARTRIDGE_ADDRESSES[chainId] : undefined;

  return useReadContract({
    address,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice',
    query: { 
      enabled: Boolean(address),
      retry: 3,
      retryDelay: 1000
    }
  });
}
