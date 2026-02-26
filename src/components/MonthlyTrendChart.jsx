import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

export default function MonthlyTrendChart({ data, embedded = false }) {
  const { t } = useTranslation();

  const inner = (
    <div style={{ flex: 1, minHeight: 0, height: embedded ? '100%' : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 20, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} interval="preserveStartEnd" />
          <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} domain={[0, 100]} tickFormatter={v => `${v}%`} />
          <YAxis yAxisId="right" orientation="right" stroke="#334155" fontSize={10} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', fontSize: '0.75rem' }}
            itemStyle={{ color: '#fff' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            formatter={(value, name) => name === t('charts.winRateLabel') ? `${value}%` : value}
          />
          <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
          <Bar yAxisId="right" dataKey="total" name={t('charts.gamesLabel')} fill="#334155" radius={[2, 2, 0, 0]} opacity={0.6} />
          <Line yAxisId="left" type="monotone" dataKey="winRate" name={t('charts.winRateLabel')}
            stroke="#00FF9C" strokeWidth={2} dot={{ r: 2, fill: '#00FF9C', strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{inner}</div>;

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.monthlyTrend')}</h4>
      {inner}
    </div>
  );
}
