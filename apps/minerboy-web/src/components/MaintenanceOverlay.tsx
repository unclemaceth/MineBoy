// apps/minerboy-web/src/components/MaintenanceOverlay.tsx
'use client';
import React from 'react';

export default function MaintenanceOverlay(props: { message?: string; untilIso?: string | null }) {
  const untilStr = props.untilIso ? new Date(props.untilIso).toLocaleString() : null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#2a4a3d',
        border: '3px solid #4a7d5f',
        borderRadius: 12,
        padding: 24,
        maxWidth: 320,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
        }}>
          MAINTENANCE MODE 🛠️
        </div>
        
        <div style={{
          color: '#64ff8a',
          fontSize: 14,
          fontFamily: 'Menlo, monospace',
          marginBottom: 16,
          opacity: 0.9,
        }}>
          {props.message || 'We\'re shipping an update. Back shortly.'}
        </div>

        {untilStr && (
          <div style={{
            color: '#64ff8a',
            fontSize: 12,
            fontFamily: 'Menlo, monospace',
            opacity: 0.7,
          }}>
            ETA: {untilStr}
          </div>
        )}
      </div>
    </div>
  );
}
