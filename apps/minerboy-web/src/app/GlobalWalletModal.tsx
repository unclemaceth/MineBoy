'use client';

import WalletConnectionModal from '@/components/WalletConnectionModal';
import { useWalletModal } from '@/state/walletModal';

export default function GlobalWalletModal() {
  const { isOpen, close } = useWalletModal();
  return <WalletConnectionModal isOpen={isOpen} onClose={close} />;
}
