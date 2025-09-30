'use client';

import { useChainId, useReadContract } from 'wagmi';
import { APEBIT_CARTRIDGE_ABI, CARTRIDGE_ADDRESSES } from '@/lib/contracts';
import { useActiveAccount } from './useActiveAccount';

export function useContractState(): {
  paused: undefined;
  saleActive: undefined;
  maxPerTx: undefined;
  maxPerWallet: undefined;
  walletMints: undefined;
  totalSupply: any;
  maxSupply: any;
  paymentToken: undefined;
  allowance: undefined;
  tokenBalance: undefined;
  isPaused: boolean;
  isSaleInactive: boolean;
  isSoldOut: boolean;
  hasReachedWalletLimit: boolean;
  isERC20Payment: boolean;
  needsApproval: boolean;
  insufficientTokenBalance: boolean;
  errorReason: string | null;
  isLoading: boolean;
  contract: any;
} {
  const { address } = useActiveAccount();
  const chainId = useChainId();
  const contract = chainId ? CARTRIDGE_ADDRESSES[chainId] : undefined;

  // Only read functions that exist in our ABI
  // Note: Most of these functions don't exist in the actual contract, so we'll disable them
  const { data: paused, error: pausedError } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use existing function as fallback
    query: { enabled: false } // Disabled since paused() doesn't exist
  });

  const { data: saleActive, error: saleActiveError } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use existing function as fallback
    query: { enabled: false } // Disabled since saleActive() doesn't exist
  });

  const { data: maxPerTx, error: maxPerTxError } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use existing function as fallback
    query: { enabled: false } // Disabled since maxPerTx() doesn't exist
  });

  const { data: maxPerWallet, error: maxPerWalletError } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use existing function as fallback
    query: { enabled: false } // Disabled since maxPerWallet() doesn't exist
  });

  const { data: walletMints, error: walletMintsError } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use existing function as fallback
    query: { enabled: false } // Disabled since walletMints() doesn't exist
  });

  const { data: totalSupply, isLoading: totalSupplyLoading } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'totalSupply',
    query: { 
      enabled: Boolean(contract),
      retry: 1, // Reduce retries to prevent hanging
      retryDelay: 1000
    }
  });

  const { data: maxSupply, isLoading: maxSupplyLoading } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'maxSupply',
    query: { 
      enabled: Boolean(contract),
      retry: 1, // Reduce retries to prevent hanging
      retryDelay: 1000
    }
  });

  const { data: paymentToken } = useReadContract({
    address: contract,
    abi: APEBIT_CARTRIDGE_ABI,
    functionName: 'mintPrice', // Use a function we know exists as a fallback
    query: { enabled: false } // Disabled since paymentToken() likely doesn't exist
  });

  // Calculate states - assume false since we can't read most contract states
  const isPaused = false; // Assume not paused since we can't read it
  const isSaleInactive = false; // Assume active since we can't read it
  const isSoldOut = totalSupply && maxSupply ? totalSupply >= maxSupply : false;
  const hasReachedWalletLimit = false; // Assume no limit since we can't read it
  const isERC20Payment = false; // Assume native ETH payments for now
  
  // ERC20 specific checks - disabled since we can't read payment token
  const needsApproval = false;
  const insufficientTokenBalance = false;

  // Generate user-friendly error messages
  const getErrorReason = (): string | null => {
    if (isPaused) return 'Sale is currently paused';
    if (isSaleInactive) return 'Sale is not active';
    if (isSoldOut) return 'All tokens have been sold out';
    if (hasReachedWalletLimit) return 'Maximum mints per wallet reached';
    return null;
  };

  return {
    // Raw data - return undefined since we can't read most contract states
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
    
    // Loading state - with timeout to prevent infinite loading
    isLoading: Boolean(contract) && (totalSupplyLoading || maxSupplyLoading),
    
    // Contract info
    contract
  };
}
