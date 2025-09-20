'use client';

import { useAccount, useBalance, useGasPrice, useEstimateGas } from 'wagmi';
import { formatEther, encodeFunctionData } from 'viem';
import { APEBIT_CARTRIDGE_ABI } from '@/lib/contracts';

export function useSpendChecks(to: `0x${string}` | undefined, value: bigint, count: number = 1) {
  const { address } = useAccount();
  
  // Wrap all hooks in try-catch to prevent crashes
  let bal, balanceLoading, gasPrice, gasPriceLoading, gasLimit, gasLimitLoading, gasEstimateError;
  
  try {
    const balanceResult = useBalance({ address });
    bal = balanceResult.data;
    balanceLoading = balanceResult.isLoading;
  } catch (error) {
    console.warn('Balance check failed:', error);
    bal = undefined;
    balanceLoading = false;
  }
  
  try {
    const gasPriceResult = useGasPrice();
    gasPrice = gasPriceResult.data;
    gasPriceLoading = gasPriceResult.isLoading;
  } catch (error) {
    console.warn('Gas price check failed:', error);
    gasPrice = undefined;
    gasPriceLoading = false;
  }
  
  try {
           // Generate proper calldata for mint(address to)
           const data = encodeFunctionData({
             abi: APEBIT_CARTRIDGE_ABI,
             functionName: 'mint',
             args: [address || '0x0000000000000000000000000000000000000000']
           });

    const gasEstimateResult = useEstimateGas({ 
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
    gasLimit = gasEstimateResult.data;
    gasLimitLoading = gasEstimateResult.isLoading;
    gasEstimateError = gasEstimateResult.error;
  } catch (error) {
    console.warn('Gas estimation failed:', error);
    gasLimit = undefined;
    gasLimitLoading = false;
    gasEstimateError = error;
  }

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
