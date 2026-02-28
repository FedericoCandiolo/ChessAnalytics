import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { Maximize2, X } from 'lucide-react';

const BUCKET_COLORS = {
  '<50': '#ef4444', '50-59': '#f97316', '60-69': '#eab308',
  '70-79': '#84cc16', '80-89': '#22c55e', '90+': '#00FF9C'
};

export default function AccuracyChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [maximized, setMaximized] = useState(false);
  const hasData = data.some(d => d.count > 0);

  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position', 'fixed').style('background', 'rgba(15,23,42,0.95)')
      .style('border', '1px solid #334155').style('border-radius', '6px')
      .style('padding', '8px 12px').style('font-size', '12px').style('color', '#fff')
      .style('pointer-events', 'none').style('opacity', '0').style('z-index', '10001');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasData) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 30, mr = 10, mt = 8, mb = 28;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const x = d3.scaleBand().domain(data.map(d => d.bucket)).range([0, iW]).padding(0.3);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.15]).range([iH, 0]);

      g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(4))
        .selectAll('line').style('stroke', '#2d333f').style('stroke-dasharray', '3,3');
      g.select('.grid .domain').remove();

      g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => d))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.select('.domain').remove();

      g.selectAll('rect').data(data).join('rect')
        .attr('x', d => x(d.bucket)).attr('y', iH)
        .attr('width', x.bandwidth()).attr('height', 0)
        .attr('fill', d => BUCKET_COLORS[d.bucket] || '#01B6FF').attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          tt.html(`<strong>${d.bucket}%</strong>: ${d.count} ${t('charts.gamesLabel')}`)
            .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
        })
        .on('mousemove', (event) => tt.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`))
        .on('mouseout', () => tt.style('opacity', '0'))
        .transition().duration(500).delay((_, i) => i * 60).ease(d3.easeCubicOut)
        .attr('y', d => y(d.count)).attr('height', d => Math.max(0, iH - y(d.count)));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, hasData, t]);

  const inner = hasData
    ? <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '1.25rem' }}>
        {t('charts.noAccuracyData')}
      </div>;

  const card = (
    <div className={`chart-card${maximized ? ' chart-card--max' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.accuracyDist')}</h4>
        <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      {inner}
    </div>
  );

  if (maximized) {
    return createPortal(
      <div className="chart-max-overlay" onClick={e => { if (e.target === e.currentTarget) setMaximized(false); }}>
        {card}
      </div>,
      document.body
    );
  }
  return card;
}
