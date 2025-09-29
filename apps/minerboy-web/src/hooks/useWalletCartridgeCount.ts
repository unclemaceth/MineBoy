import { useReadContract } from 'wagmi';
import { CARTRIDGE_ADDRESSES, APEBIT_CARTRIDGE_ABI } from '@/lib/contracts';

export function useWalletCartridgeCount(walletAddress: string | undefined, chainId: number) {
  const contractAddress = chainId ? CARTRIDGE_ADDRESSES[chainId] : null;
  
  const { data: balance, isLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId,
    query: {
      enabled: !!contractAddress && !!walletAddress
    }
  });

  const ownedCount = balance ? Number(balance) : 0;
  const canMint = ownedCount === 0;

  return {
    ownedCount,
    canMint,
    isLoading
  };
}
