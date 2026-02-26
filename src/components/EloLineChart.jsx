import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { ELO_COLORS } from '../constants';

export default function EloLineChart({ data }) {
  const { t } = useTranslation();
  return (
    <div className="chart-card chart-card-elo" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.eloEvolution')}</h4>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" hide />
            <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke="#94a3b8" fontSize={10} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
            <Legend wrapperStyle={{ paddingTop: '0.9rem' }} />
            <Line name={t('timeClasses.rapid')} type="monotone" dataKey="rapid" stroke={ELO_COLORS.rapid} strokeWidth={2} connectNulls
              dot={{ r: 3, fill: ELO_COLORS.rapid, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line name={t('timeClasses.blitz')} type="monotone" dataKey="blitz" stroke={ELO_COLORS.blitz} strokeWidth={2} connectNulls
              dot={{ r: 3, fill: ELO_COLORS.blitz, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line name={t('timeClasses.bullet')} type="monotone" dataKey="bullet" stroke={ELO_COLORS.bullet} strokeWidth={2} connectNulls
              dot={{ r: 3, fill: ELO_COLORS.bullet, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
