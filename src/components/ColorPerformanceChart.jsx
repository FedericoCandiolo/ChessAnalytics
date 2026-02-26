import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';

export default function ColorPerformanceChart({ data, embedded = false }) {
  const { t } = useTranslation();

  const chartData = data.map(d => ({
    ...d,
    label: t(`colorLabels.${d.name}`, d.name)
  }));

  const inner = (
    <div style={{ flex: 1, minHeight: 0, height: embedded ? '100%' : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={10} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', fontSize: '0.75rem' }}
            itemStyle={{ color: '#fff' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
          <Bar dataKey="victoria" name={t('results.wins')} stackId="a" fill={RESULT_COLORS.win} />
          <Bar dataKey="tablas" name={t('results.drawsLabel')} stackId="a" fill={RESULT_COLORS.draw} />
          <Bar dataKey="derrota" name={t('results.losses')} stackId="a" fill={RESULT_COLORS.loss} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{inner}</div>;

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.colorPerformance')}</h4>
      {inner}
    </div>
  );
}
