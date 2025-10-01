import { useReadContract } from 'wagmi';
import { CARTRIDGE_ADDRESSES, APEBIT_CARTRIDGE_ABI } from '@/lib/contracts';

export function useWalletCartridgeCount(walletAddress: string | undefined, chainId: number) {
  const contractAddress = chainId ? CARTRIDGE_ADDRESSES[chainId] : null;
  
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId,
    query: {
      enabled: !!contractAddress && !!walletAddress
    }
  });

  const { data: maxPerWallet, isLoading: maxLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'maxPerWallet',
    chainId,
    query: {
      enabled: !!contractAddress
    }
  });

  const ownedCount = balance ? Number(balance) : 0;
  const maxAllowed = maxPerWallet ? Number(maxPerWallet) : 1;
  const canMint = ownedCount < maxAllowed;

  return {
    ownedCount,
    canMint,
    isLoading: balanceLoading || maxLoading,
    maxAllowed
  };
}
