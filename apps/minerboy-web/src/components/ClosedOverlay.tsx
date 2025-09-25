"use client";
import React from 'react';

export default function ClosedOverlay() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'monospace',
    }}>
      <div style={{
        backgroundColor: '#ff0000',
        color: '#ffffff',
        padding: '40px',
        borderRadius: '20px',
        textAlign: 'center',
        border: '5px solid #ffffff',
        fontSize: '48px',
        fontWeight: 'bold',
        boxShadow: '0 0 50px rgba(255, 0, 0, 0.8)',
      }}>
        <div style={{ marginBottom: '20px' }}>🚫</div>
        <div>CLOSED</div>
        <div style={{ fontSize: '24px', marginTop: '20px' }}>
          Testing new features
        </div>
        <div style={{ fontSize: '18px', marginTop: '10px' }}>
          Back in 30 minutes
        </div>
      </div>
    </div>
  );
}
