import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { Maximize2, X } from 'lucide-react';

export default function MonthlyTrendChart({ data }) {
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
    if (!container || !data || data.length === 0) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 38, mr = 38, mt = 10, mb = 40;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const maxTotal = d3.max(data, d => d.total) || 1;
      const xBar  = d3.scaleBand().domain(data.map(d => d.label)).range([0, iW]).padding(0.25);
      const yRight = d3.scaleLinear().domain([0, maxTotal * 1.2]).range([iH, 0]);
      const yLeft  = d3.scaleLinear().domain([0, 100]).range([iH, 0]);

      // Bars (game count) with animation
      g.selectAll('rect').data(data).join('rect')
        .attr('x', d => xBar(d.label)).attr('y', iH)
        .attr('width', xBar.bandwidth()).attr('height', 0)
        .attr('fill', '#334155').attr('opacity', 0.7).attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          tt.html(`<strong>${d.label}</strong><br/>${t('charts.gamesLabel')}: ${d.total}<br/>${t('charts.winRateLabel')}: ${d.winRate}%`)
            .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
        })
        .on('mousemove', (event) => tt.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`))
        .on('mouseout', () => tt.style('opacity', '0'))
        .transition().duration(500).delay((_, i) => i * 30).ease(d3.easeCubicOut)
        .attr('y', d => yRight(d.total)).attr('height', d => Math.max(0, iH - yRight(d.total)));

      // Win rate line
      const line = d3.line().x(d => xBar(d.label) + xBar.bandwidth() / 2).y(d => yLeft(d.winRate)).curve(d3.curveMonotoneX);
      const area = d3.area().x(d => xBar(d.label) + xBar.bandwidth() / 2).y0(iH).y1(d => yLeft(d.winRate)).curve(d3.curveMonotoneX);

      g.append('path').datum(data).attr('fill', '#00FF9C').attr('opacity', 0.08).attr('d', area);
      const linePath = g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#00FF9C').attr('stroke-width', 2).attr('d', line);
      const lineLen = linePath.node().getTotalLength();
      linePath.attr('stroke-dasharray', lineLen).attr('stroke-dashoffset', lineLen)
        .transition().duration(800).delay(300).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

      g.selectAll('.dot').data(data).join('circle').attr('class', 'dot')
        .attr('cx', d => xBar(d.label) + xBar.bandwidth() / 2).attr('cy', d => yLeft(d.winRate))
        .attr('r', 3).attr('fill', '#00FF9C').attr('opacity', 0)
        .transition().delay(800).attr('opacity', 1);

      // Axes
      const skip = Math.max(1, Math.ceil(data.length / 8));
      g.append('g').attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xBar).tickValues(data.filter((_, i) => i % skip === 0).map(d => d.label)))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8').attr('transform', 'rotate(-25)').attr('text-anchor', 'end');
      g.append('g').call(d3.axisLeft(yLeft).ticks(4).tickFormat(d => `${d}%`))
        .selectAll('text').style('font-size', '10px').style('fill', '#00FF9C');
      g.append('g').attr('transform', `translate(${iW},0)`)
        .call(d3.axisRight(yRight).ticks(4))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.selectAll('.domain').style('stroke', '#334155');
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  const card = (
    <div className={`chart-card${maximized ? ' chart-card--max' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.monthlyTrend')}</h4>
        <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
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
