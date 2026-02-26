import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';

export default function ResultsPieChart({ data, winRate }) {
  const { t } = useTranslation();

  const translatedData = data.map(d => ({
    ...d,
    name: d.name.includes('Victoria') || d.name.includes('Win') ? t('results.wins')
      : d.name.includes('Derrota') || d.name.includes('Loss') ? t('results.losses')
      : t('results.drawsLabel')
  }));

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.resultDistribution')}</h4>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={translatedData} dataKey="value" innerRadius="52%" outerRadius="74%" paddingAngle={4}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }}
              itemStyle={{ color: '#fff', fontSize: '0.75rem' }}
            />
            <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label — sits over the donut hole */}
        <div style={{
          position: 'absolute',
          top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '1.375rem', fontWeight: 'bold', color: '#00FF9C', lineHeight: 1 }}>{winRate}%</div>
          <div style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('charts.winRate')}
          </div>
        </div>
      </div>
    </div>
  );
}
