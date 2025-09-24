'use client';
import * as React from 'react';
import MaintenanceOverlay from '@/components/MaintenanceOverlay';

type Maint = { enabled: boolean; message?: string; untilIso?: string | null };

export default function MaintenanceGate() {
  const [maint, setMaint] = React.useState<Maint | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";

  const check = React.useCallback(async () => {
    if (!backend) {
      console.log('[MAINTENANCE_GATE] No backend URL configured');
      return;
    }
    try {
      console.log('[MAINTENANCE_GATE] Checking maintenance status...');
      const r = await fetch(`${backend}/v2/maintenance`, { cache: 'no-store' });
      console.log('[MAINTENANCE_GATE] Response status:', r.status);
      if (!r.ok) {
        console.log('[MAINTENANCE_GATE] Response not ok, keeping previous state');
        return; // keep previous state
      }
      const data = await r.json();
      console.log('[MAINTENANCE_GATE] Maintenance data:', data);
      setMaint(data);
    } catch (error) {
      console.error('[MAINTENANCE_GATE] Network error:', error);
      // network error: keep previous state
    }
  }, [backend]);

  React.useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  console.log('[MAINTENANCE_GATE] Render check:', { maint, enabled: maint?.enabled });
  
  if (!maint?.enabled) {
    console.log('[MAINTENANCE_GATE] Maintenance not enabled, not showing overlay');
    return null;
  }
  
  console.log('[MAINTENANCE_GATE] Showing maintenance overlay');
  return <MaintenanceOverlay message={maint.message} untilIso={maint.untilIso ?? null} />;
}
