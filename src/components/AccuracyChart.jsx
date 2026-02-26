import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';

const BUCKET_COLORS = {
  '<50':   '#ef4444',
  '50-59': '#f97316',
  '60-69': '#eab308',
  '70-79': '#84cc16',
  '80-89': '#22c55e',
  '90+':   '#00FF9C'
};

export default function AccuracyChart({ data, embedded = false }) {
  const { t } = useTranslation();
  const hasData = data.some(d => d.count > 0);

  const inner = hasData ? (
    <div style={{ flex: 1, minHeight: 0, height: embedded ? '100%' : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={10} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', fontSize: '0.75rem' }}
            itemStyle={{ color: '#fff' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="count" name={t('charts.gamesLabel')} radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] || '#01B6FF'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '1.25rem' }}>
      {t('charts.noAccuracyData')}
    </div>
  );

  if (embedded) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{inner}</div>;

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.accuracyDist')}</h4>
      {inner}
    </div>
  );
}
