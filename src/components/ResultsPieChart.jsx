import React, { useRef, useEffect, useState } from 'react';

import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { Maximize2, X } from 'lucide-react';

export default function ResultsPieChart({ data, winRate }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position', 'fixed').style('background', 'rgba(15,23,42,0.95)')
      .style('border', '1px solid #334155').style('border-radius', '6px')
      .style('padding', '8px 12px').style('font-size', '12px').style('color', '#fff')
      .style('pointer-events', 'none').style('opacity', '0').style('z-index', '9999');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const legendH = 28;
      const chartH = height - legendH;
      const radius = Math.min(width, chartH) / 2 * 0.82;
      const innerRadius = radius * 0.60;
      const g = svg.append('g').attr('transform', `translate(${width / 2},${chartH / 2})`);
      const tt = tooltipRef.current;
      const total = d3.sum(data, d => d.value);

      const pie = d3.pie().value(d => d.value).padAngle(0.035).sort(null);
      const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
      const arcH = d3.arc().innerRadius(innerRadius).outerRadius(radius * 1.06);

      const translatedData = data.map(d => ({
        ...d,
        name: d.name.includes('Victoria') ? t('results.wins')
          : d.name.includes('Derrota') ? t('results.losses')
          : t('results.drawsLabel')
      }));

      const paths = g.selectAll('path').data(pie(translatedData)).join('path')
        .attr('fill', d => d.data.color).style('cursor', 'pointer')
        .attr('d', d => arc({ ...d, endAngle: d.startAngle }))
        .on('mouseover', function (event, d) {
          d3.select(this).transition().duration(150).attr('d', arcH);
          const pct = total > 0 ? Math.round(d.data.value / total * 100) : 0;
          tt.html(`<strong>${d.data.name}</strong>: ${d.data.value} (${pct}%)`)
            .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
        })
        .on('mousemove', (event) => tt.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`))
        .on('mouseout', function () { d3.select(this).transition().duration(150).attr('d', arc); tt.style('opacity', '0'); });
      paths.transition().duration(750).ease(d3.easeCubicOut)
        .attrTween('d', d => {
          const interp = d3.interpolate({ ...d, endAngle: d.startAngle }, d);
          return t2 => arc(interp(t2));
        });

      // Center text
      g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
        .style('font-size', `${Math.max(16, Math.min(28, radius * 0.38))}px`)
        .style('font-weight', '700').style('fill', '#00FF9C').text(`${winRate}%`);
      g.append('text').attr('text-anchor', 'middle').attr('dy', '1.3em')
        .style('font-size', `${Math.max(8, radius * 0.12)}px`).style('fill', '#94a3b8')
        .style('letter-spacing', '0.05em').text(t('charts.winRate').toUpperCase());

      // Legend
      const lg = svg.append('g').attr('transform', `translate(${width / 2},${height - 6})`);
      const lw = Math.min(100, width / translatedData.length - 8);
      translatedData.forEach((d, i) => {
        const x = (i - (translatedData.length - 1) / 2) * (lw + 8);
        const item = lg.append('g').attr('transform', `translate(${x},0)`);
        item.append('circle').attr('r', 4).attr('fill', d.color).attr('cy', -10);
        item.append('text').attr('x', 8).attr('dy', '-6px').style('font-size', '10px').style('fill', '#94a3b8')
          .text(`${d.name} (${total > 0 ? Math.round(d.value / total * 100) : 0}%)`);
      });
    };

    draw();
    const ro = new ResizeObserver(() => requestAnimationFrame(draw));
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, winRate, t]);

  return (
    <>
      {maximized && <div className="chart-max-overlay" onClick={() => setMaximized(false)} />}
      <div className={`chart-card${maximized ? ' chart-card--max' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.resultDistribution')}</h4>
          <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
            {maximized ? <X size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
        <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      </div>
    </>
  );
}
