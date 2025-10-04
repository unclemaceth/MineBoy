import { useReadContract } from 'wagmi';
import { APECHAIN_CHAIN_ID } from '@/lib/contracts';

const NPC_CONTRACT = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA' as const;

// Standard ERC721 balanceOf ABI
const BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to fetch NPC balance for a given wallet address
 * Returns the number of NPCs owned and loading/error states
 */
export function useNPCBalance(walletAddress?: `0x${string}`) {
  const { data, isLoading, isError } = useReadContract({
    address: NPC_CONTRACT,
    abi: BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: APECHAIN_CHAIN_ID,
    query: {
      enabled: !!walletAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const npcBalance = data ? Number(data) : 0;

  return {
    npcBalance,
    isLoading,
    isError,
  };
}
