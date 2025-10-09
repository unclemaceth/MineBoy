'use client';

import { useState } from 'react';
import { parseEther, isAddress } from 'viem';
import { useActiveAccount } from './useActiveAccount';
import { useActiveWalletClient } from './useActiveWalletClient';
import { apePublicClient } from '@/lib/apechain';

const APECHAIN_ID = 33139;
const APESCAN_URL = 'https://apescan.io';

type SendState = {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  explorerUrl?: string;
  errorMsg?: string;
};

type SendParams = {
  to: `0x${string}`;
  amount: string; // in APE (human-readable)
};

export function useSendAPE() {
  const { address: fromAddress } = useActiveAccount();
  const walletClient = useActiveWalletClient();
  const [state, setState] = useState<SendState>({ status: 'idle' });

  async function send({ to, amount }: SendParams) {
    if (!walletClient || !fromAddress) {
      throw new Error('Wallet not connected');
    }

    // Validate recipient address
    if (!isAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    // Enforce ApeChain
    const chainId = await walletClient.getChainId();
    if (chainId !== APECHAIN_ID) {
      throw new Error(`Please switch to ApeChain (chain ID ${APECHAIN_ID})`);
    }

    // Validate amount
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum < 0.0001) {
      throw new Error('Amount must be at least 0.0001 APE');
    }

    setState({ status: 'pending' });

    try {
      const value = parseEther(amount);

      // Estimate gas with safety buffer using public client
      const estimatedGas = await apePublicClient.estimateGas({
        to,
        value,
        account: fromAddress,
      });

      // Add 20% buffer for gas estimation
      const gasLimit = estimatedGas + (estimatedGas / 5n);

      // Set reasonable max fees to prevent spikes
      const maxPriorityFeePerGas = parseEther('0.000000002'); // 2 gwei
      const maxFeePerGas = maxPriorityFeePerGas * 3n; // 6 gwei

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to,
        value,
        gas: gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas,
      });

      const explorerUrl = `${APESCAN_URL}/tx/${hash}`;
      
      setState({
        status: 'confirming',
        txHash: hash,
        explorerUrl,
      });

      // Wait for 1 confirmation using public client
      const receipt = await apePublicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === 'success') {
        setState({
          status: 'success',
          txHash: hash,
          explorerUrl,
        });
      } else {
        throw new Error('Transaction failed');
      }

      return { hash, receipt };
    } catch (error: any) {
      const errorMsg = error?.shortMessage || error?.message || 'Transaction failed';
      setState({
        status: 'error',
        errorMsg,
      });
      throw error;
    }
  }

  function reset() {
    setState({ status: 'idle' });
  }

  return {
    send,
    reset,
    state,
    isIdle: state.status === 'idle',
    isPending: state.status === 'pending',
    isConfirming: state.status === 'confirming',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
}

