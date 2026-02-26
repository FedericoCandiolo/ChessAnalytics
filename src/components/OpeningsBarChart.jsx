import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';
import StackedTooltip from './StackedTooltip';

export default function OpeningsBarChart({ data }) {
  const { t } = useTranslation();
  // Each entry takes ~1.875rem; min 15.625rem so ResponsiveContainer always has room
  const dynamicHeight = Math.max(240, data.length * 30);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 0.625rem 0', fontSize: '0.875rem' }}>{t('charts.openingSuccess')}</h4>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height={dynamicHeight}>
          <BarChart data={data} layout="vertical" margin={{ right: 2.5 * 16 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={150} />
            <Tooltip content={<StackedTooltip />} />
            <Bar dataKey="victoria" stackId="a" fill={RESULT_COLORS.win} name={t('results.wins')} />
            <Bar dataKey="tablas" stackId="a" fill={RESULT_COLORS.draw} name={t('results.drawsLabel')} />
            <Bar dataKey="derrota" stackId="a" fill={RESULT_COLORS.loss} name={t('results.losses')} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="total" position="right" fill="#fff" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
