'use client';

import { useAccount, useBalance, useGasPrice, useEstimateGas } from 'wagmi';
import { formatEther } from 'viem';

export function useSpendChecks(to: `0x${string}` | undefined, value: bigint, data?: `0x${string}`) {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address });
  const { data: gasPrice } = useGasPrice();
  const { data: gasLimit } = useEstimateGas({ 
    account: address, 
    to, 
    data, 
    value, 
    query: { enabled: Boolean(address && to) } 
  });

  const fee = gasPrice && gasLimit ? gasPrice * gasLimit : undefined;
  const enoughForFee = bal && fee ? bal.value >= fee : true;
  const enoughForValue = bal ? bal.value >= value : true;
  const enoughTotal = bal && fee ? bal.value >= (value + fee) : true;

  return { 
    bal, 
    gasPrice, 
    gasLimit, 
    fee, 
    feeFormatted: fee ? formatEther(fee) : undefined,
    enoughForFee, 
    enoughForValue, 
    enoughTotal,
    isLoading: !bal || (to && !gasLimit)
  };
}
