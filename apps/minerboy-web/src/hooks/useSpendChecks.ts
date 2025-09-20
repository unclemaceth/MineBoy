'use client';

import { useAccount, useBalance, useGasPrice, useEstimateGas } from 'wagmi';
import { formatEther } from 'viem';

export function useSpendChecks(to: `0x${string}` | undefined, value: bigint, data?: `0x${string}`) {
  const { address } = useAccount();
  const { data: bal, isLoading: balanceLoading } = useBalance({ address });
  const { data: gasPrice, isLoading: gasPriceLoading } = useGasPrice();
  const { data: gasLimit, isLoading: gasLimitLoading, error: gasEstimateError } = useEstimateGas({ 
    account: address, 
    to, 
    data, 
    value, 
    query: { 
      enabled: Boolean(address && to),
      retry: 1, // Reduce retries to prevent hanging
      retryDelay: 1000
    } 
  });

  const fee = gasPrice && gasLimit ? gasPrice * gasLimit : undefined;
  const enoughForFee = bal && fee ? bal.value >= fee : true;
  const enoughForValue = bal ? bal.value >= value : true;
  const enoughTotal = bal && fee ? bal.value >= (value + fee) : true;

  // If gas estimation fails, assume it's okay (common on custom chains)
  const isLoading = balanceLoading || gasPriceLoading || (to && gasLimitLoading && !gasEstimateError);

  return { 
    bal, 
    gasPrice, 
    gasLimit, 
    fee, 
    feeFormatted: fee ? formatEther(fee) : undefined,
    enoughForFee, 
    enoughForValue, 
    enoughTotal,
    isLoading,
    gasEstimateError
  };
}
