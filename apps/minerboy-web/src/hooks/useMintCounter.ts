import { useReadContract } from 'wagmi';
import { CARTRIDGE_ADDRESSES, APEBIT_CARTRIDGE_ABI } from '@/lib/contracts';

export function useMintCounter(chainId: number) {
  const contractAddress = chainId ? CARTRIDGE_ADDRESSES[chainId] : null;
  
  const { data: totalSupply, isLoading: totalSupplyLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'totalSupply',
    chainId,
    query: {
      enabled: !!contractAddress
    }
  });

  const { data: maxSupply, isLoading: maxSupplyLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'maxSupply',
    chainId,
    query: {
      enabled: !!contractAddress
    }
  });

  const minted = totalSupply ? Number(totalSupply) : 0;
  const max = maxSupply ? Number(maxSupply) : 250;
  const remaining = max - minted;

  return {
    minted,
    max,
    remaining,
    isLoading: totalSupplyLoading || maxSupplyLoading
  };
}
