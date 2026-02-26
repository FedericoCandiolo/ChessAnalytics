import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LoadingOverlay() {
  const { t } = useTranslation();
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,11,14,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 2000, gap: '20px'
    }}>
      <div style={{
        width: '56px', height: '56px',
        border: '4px solid #2d333f',
        borderTop: '4px solid #00FF9C',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite'
      }} />
      <span style={{ color: '#94a3b8', fontSize: '14px' }}>{t('loading')}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
