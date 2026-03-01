import React, { useRef, useEffect, useState } from 'react';

import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';
import { Maximize2, X } from 'lucide-react';

const KEYS = ['victoria', 'tablas', 'derrota'];

export default function ColorPerformanceChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [maximized, setMaximized] = useState(false);

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
    if (!container) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 35, mr = 10, mt = 8, mb = 50;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const chartData = data.map(d => ({ ...d, label: t(`colorLabels.${d.name}`, d.name) }));
      const maxVal = d3.max(chartData, d => d.victoria + d.tablas + d.derrota);
      const x = d3.scaleBand().domain(chartData.map(d => d.label)).range([0, iW]).padding(0.4);
      const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([iH, 0]);
      const stack = d3.stack().keys(KEYS);
      const colors = [RESULT_COLORS.win, RESULT_COLORS.draw, RESULT_COLORS.loss];
      const names = [t('results.wins'), t('results.drawsLabel'), t('results.losses')];

      g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(4))
        .selectAll('line').style('stroke', '#2d333f').style('stroke-dasharray', '3,3');
      g.select('.grid .domain').remove();

      g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x))
        .selectAll('text').style('font-size', '12px').style('fill', '#94a3b8');
      g.append('g').call(d3.axisLeft(y).ticks(4))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.select('.domain').remove();

      stack(chartData).forEach((layer, li) => {
        g.selectAll(`.bar-${li}`).data(layer).join('rect')
          .attr('class', `bar-${li}`)
          .attr('x', d => x(d.data.label)).attr('y', iH)
          .attr('width', x.bandwidth()).attr('height', 0)
          .attr('fill', colors[li]).attr('rx', li === 2 ? 3 : 0)
          .style('cursor', 'pointer')
          .on('mouseover', (event, d) => {
            tt.html(`<strong>${d.data.label}</strong><br/>
              <span style="color:${RESULT_COLORS.win}">${t('results.wins')}: ${d.data.victoria}</span><br/>
              <span style="color:${RESULT_COLORS.draw}">${t('results.drawsLabel')}: ${d.data.tablas}</span><br/>
              <span style="color:${RESULT_COLORS.loss}">${t('results.losses')}: ${d.data.derrota}</span>`)
              .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
          })
          .on('mousemove', (event) => tt.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`))
          .on('mouseout', () => tt.style('opacity', '0'))
          .transition().duration(500).delay(li * 80).ease(d3.easeCubicOut)
          .attr('y', d => y(d[1])).attr('height', d => Math.max(0, y(d[0]) - y(d[1])));
      });

      const legG = svg.append('g').attr('transform', `translate(${ml},${height - 8})`);
      KEYS.forEach((k, i) => {
        const lx = i * 80;
        legG.append('rect').attr('x', lx).attr('y', -14).attr('width', 9).attr('height', 9).attr('fill', colors[i]).attr('rx', 2);
        legG.append('text').attr('x', lx + 13).attr('y', -6).style('font-size', '10px').style('fill', '#94a3b8').text(names[i]);
      });
    };

    draw();
    const ro = new ResizeObserver(() => requestAnimationFrame(draw));
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  return (
    <>
      {maximized && <div className="chart-max-overlay" onClick={() => setMaximized(false)} />}
      <div className={`chart-card${maximized ? ' chart-card--max' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.colorPerformance')}</h4>
          <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
            {maximized ? <X size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
        <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      </div>
    </>
  );
}
