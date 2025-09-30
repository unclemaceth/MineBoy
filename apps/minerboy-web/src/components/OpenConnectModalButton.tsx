'use client';

import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useActiveAccount } from '@/hooks/useActiveAccount';

export default function OpenConnectModalButton({ 
  children = 'Connect Wallet', 
  className = '' 
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { open } = useWeb3Modal();
  const { isConnected } = useActiveAccount();

  // Hide button when connected
  if (isConnected) return null;

  return (
    <button 
      onClick={() => {
        console.log('OpenConnectModalButton: Opening Web3Modal directly');
        open();
      }} 
      className={`h-12 rounded-xl bg-[#4BE477] px-5 font-semibold text-black hover:opacity-90 ${className}`}
    >
      {children}
    </button>
  );
}