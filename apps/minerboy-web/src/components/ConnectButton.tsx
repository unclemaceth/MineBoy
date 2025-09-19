'use client';
import { w3mReady } from '@/lib/wallet';
import { useWeb3Modal } from '@web3modal/wagmi/react';

function DisabledBtn({ label }: { label: string }) {
  return (
    <button
      disabled
      title="WalletConnect not configured"
      style={{ height: 48, padding: '0 16px', borderRadius: 12, fontSize: 16, opacity: 0.6 }}
    >
      {label}
    </button>
  );
}

function LiveBtn({ label, view }: { label: string; view?: 'Qrcode' }) {
  const { open } = useWeb3Modal();
  return (
    <button
      onClick={() => open(view ? { view: 'Connect' } : undefined)}
      style={{
        height: 48, padding: '0 16px', borderRadius: 12, fontSize: 16, fontWeight: 700,
        background: '#64ff8a', border: '2px solid #64ff8a', color: '#000'
      }}
      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#55e577'; e.currentTarget.style.borderColor = '#55e577'; }}
      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#64ff8a'; e.currentTarget.style.borderColor = '#64ff8a'; }}
    >
      {label}
    </button>
  );
}

export default function ConnectButton(props: { variant?: 'default' | 'qr'; label?: string }) {
  const label = props.label ?? (props.variant === 'qr' ? 'WalletConnect (QR)' : 'Connect Wallet');
  if (!w3mReady) return <DisabledBtn label={label} />;
  return <LiveBtn label={label} view={props.variant === 'qr' ? 'Qrcode' : undefined} />;
}
