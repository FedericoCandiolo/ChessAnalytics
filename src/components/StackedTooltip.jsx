import React from 'react';
import { useTranslation } from 'react-i18next';

export default function StackedTooltip({ active, payload, label }) {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '11px', zIndex: 100 }}>
      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#fff' }}>{label}</p>
      {payload.slice().reverse().map((entry, index) => (
        <div key={index} style={{ color: entry.color, marginBottom: '2px' }}>
          {entry.name}: {entry.value} ({((entry.value / total) * 100).toFixed(1)}%)
        </div>
      ))}
      <div style={{ borderTop: '1px solid #334155', marginTop: '5px', paddingTop: '5px', color: '#94a3b8' }}>
        Total: {total} {t('charts.gamesLabel').toLowerCase()}
      </div>
    </div>
  );
}
