import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccuracyChart from './AccuracyChart';
import ColorPerformanceChart from './ColorPerformanceChart';
import MonthlyTrendChart from './MonthlyTrendChart';

export default function ChartTabs({ accuracyData, colorData, monthlyData }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);

  const tabs = [
    { label: t('charts.accuracyDist'),    node: <AccuracyChart data={accuracyData} embedded /> },
    { label: t('charts.colorPerformance'), node: <ColorPerformanceChart data={colorData} embedded /> },
    { label: t('charts.monthlyTrend'),     node: <MonthlyTrendChart data={monthlyData} embedded /> },
  ];

  return (
    <div className="chart-card chart-card-tabs" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="chart-tabs-bar">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`chart-tab-btn${active === i ? ' active' : ''}`}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tabs[active].node}
      </div>
    </div>
  );
}
