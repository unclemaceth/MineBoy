// apps/minerboy-web/src/components/MaintenanceOverlay.tsx
'use client';
import React from 'react';

export default function MaintenanceOverlay(props: { message?: string; untilIso?: string | null }) {
  const untilStr = props.untilIso ? new Date(props.untilIso).toLocaleString() : null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 text-white">
      <div className="max-w-md text-center px-6 py-8 rounded-2xl border border-white/10 shadow-2xl">
        <h1 className="text-3xl font-black tracking-wide mb-2">MineBoy is taking a breather 🛠️</h1>
        <p className="text-white/80 mb-4">
          {props.message || 'We\'re shipping an update. Back shortly.'}
        </p>
        {untilStr && <p className="text-white/60">ETA: {untilStr}</p>}
      </div>
    </div>
  );
}
