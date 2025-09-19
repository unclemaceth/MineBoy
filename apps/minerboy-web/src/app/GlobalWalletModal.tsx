'use client';

import { useEffect, useState } from 'react';
import WalletConnectionModal from '@/components/WalletConnectionModal';

export default function GlobalWalletModal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <WalletConnectionModal />;
}
