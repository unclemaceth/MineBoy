'use client';
import * as React from 'react';
import MaintenanceOverlay from '@/components/MaintenanceOverlay';

type Maint = { enabled: boolean; message?: string; untilIso?: string | null };

export default function MaintenanceGate() {
  const [maint, setMaint] = React.useState<Maint | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const check = React.useCallback(async () => {
    if (!backend) return;
    try {
      const r = await fetch(`${backend}/v2/maintenance`, { cache: 'no-store' });
      if (!r.ok) return; // keep previous state
      setMaint(await r.json());
    } catch {
      // network error: keep previous state
    }
  }, [backend]);

  React.useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  if (!maint?.enabled) return null;
  return <MaintenanceOverlay message={maint.message} untilIso={maint.untilIso ?? null} />;
}
