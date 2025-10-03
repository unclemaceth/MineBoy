"use client";
import React from 'react';

export default function SeasonEndOverlay() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'monospace',
    }}>
      <div style={{
        backgroundColor: '#0066ff',
        color: '#ffffff',
        padding: '40px 60px',
        borderRadius: '20px',
        textAlign: 'center',
        border: '5px solid #ffffff',
        boxShadow: '0 0 50px rgba(0, 102, 255, 0.8)',
        maxWidth: '90%',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '20px' }}>🏆</div>
        <div style={{ fontSize: '42px', fontWeight: 'bold', marginBottom: '15px' }}>
          Season 1 Beta Test Over
        </div>
        <div style={{ fontSize: '24px', marginTop: '25px', lineHeight: '1.4' }}>
          Thank you for playing!
        </div>
        <div style={{ fontSize: '20px', marginTop: '15px', opacity: 0.9 }}>
          Prizes will be sent ASAP
        </div>
      </div>
    </div>
  );
}

