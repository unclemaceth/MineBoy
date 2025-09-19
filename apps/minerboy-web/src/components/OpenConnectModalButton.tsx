'use client';
import { useWalletModal } from '@/state/walletModal';

export default function OpenConnectModalButton({ children = 'Connect Wallet', className = '' }:{
  children?: React.ReactNode;
  className?: string;
}) {
  const { open } = useWalletModal();
  return (
    <button onClick={open} className={`h-12 rounded-xl bg-[#4BE477] px-5 font-semibold text-black hover:opacity-90 ${className}`}>
      {children}
    </button>
  );
}