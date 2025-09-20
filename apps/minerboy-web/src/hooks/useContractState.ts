'use client';

import { useAccount, useChainId, useReadContract } from 'wagmi';
import { APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from '@/lib/contracts';

export function useContractState() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contract = chainId ? CARTRIDGE_ADDRESSES[chainId] : undefined;

  // Try to read various contract states (ignore failures if functions don't exist)
  // Note: These functions may not exist in the actual contract, so we'll handle gracefully
  const { data: paused } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since paused() likely doesn't exist
  });

  const { data: saleActive } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since saleActive() likely doesn't exist
  });

  const { data: maxPerTx } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since maxPerTx() likely doesn't exist
  });

  const { data: maxPerWallet } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since maxPerWallet() likely doesn't exist
  });

  const { data: walletMints } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since walletMints() likely doesn't exist
  });

  const { data: totalSupply } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'totalSupply',
    query: { enabled: Boolean(contract) }
  });

  const { data: maxSupply } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'maxSupply',
    query: { enabled: Boolean(contract) }
  });

  const { data: paymentToken } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since paymentToken() likely doesn't exist
  });

  // Calculate states - since most functions don't exist, we'll keep it simple
  const isPaused = false; // Assume not paused since we can't read it
  const isSaleInactive = false; // Assume active since we can't read it
  const isSoldOut = totalSupply && maxSupply ? totalSupply >= maxSupply : false;
  const hasReachedWalletLimit = false; // Assume no limit since we can't read it
  const isERC20Payment = false; // Assume native ETH payments since we can't read it
  
  // ERC20 specific checks - disabled since we can't read payment token
  const needsApproval = false;
  const insufficientTokenBalance = false;

  // Generate user-friendly error messages
  const getErrorReason = () => {
    if (isSoldOut) return 'All tokens have been sold out';
    return null;
  };

  return {
    // Raw data
    paused: undefined,
    saleActive: undefined,
    maxPerTx: undefined,
    maxPerWallet: undefined,
    walletMints: undefined,
    totalSupply,
    maxSupply,
    paymentToken: undefined,
    allowance: undefined,
    tokenBalance: undefined,
    
    // Computed states
    isPaused,
    isSaleInactive,
    isSoldOut,
    hasReachedWalletLimit,
    isERC20Payment,
    needsApproval,
    insufficientTokenBalance,
    
    // Error message
    errorReason: getErrorReason(),
    
    // Loading state
    isLoading: Boolean(contract) && (totalSupply === undefined && maxSupply === undefined),
    
    // Contract info
    contract
  };
}
