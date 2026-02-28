import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';

const RESULT_ORDER = ['victoria', 'tablas', 'derrota'];
const COLOR_ORDER = ['white', 'black'];

export default function TimeAnalysisChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

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
    if (!container || !data || data.length === 0) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 42, mr = 14, mt = 10, mb = 60;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const resultLabels = {
        victoria: t('results.wins'), tablas: t('results.drawsLabel'), derrota: t('results.losses')
      };
      const colorLabels = {
        white: t('colorLabels.white'), black: t('colorLabels.black')
      };
      const colorFills = { white: '#e2e8f0', black: '#475569' };

      // Build grouped data: results on x axis, two bars per group (white, black)
      const resultsPresent = RESULT_ORDER.filter(r => data.some(d => d.result === r));
      const xOuter = d3.scaleBand().domain(resultsPresent).range([0, iW]).padding(0.25);
      const xInner = d3.scaleBand().domain(COLOR_ORDER).range([0, xOuter.bandwidth()]).padding(0.1);
      const maxPct = d3.max(data, d => d.avgPct) || 100;
      const y = d3.scaleLinear().domain([0, Math.min(100, maxPct * 1.2)]).range([iH, 0]);

      // Grid
      g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(5))
        .selectAll('line').style('stroke', '#2d333f').style('stroke-dasharray', '3,3');
      g.select('.grid .domain').remove();

      resultsPresent.forEach(result => {
        COLOR_ORDER.forEach(color => {
          const d = data.find(d2 => d2.result === result && d2.color === color);
          if (!d) return;
          const x0 = xOuter(result) + xInner(color);
          const barW = xInner.bandwidth();
          const barH = Math.max(0, iH - y(d.avgPct));
          const resultColor = result === 'victoria' ? RESULT_COLORS.win : result === 'derrota' ? RESULT_COLORS.loss : RESULT_COLORS.draw;

          // Bar with result color border
          g.append('rect').attr('x', x0).attr('y', y(d.avgPct)).attr('width', barW).attr('height', barH)
            .attr('fill', colorFills[color]).attr('rx', 3)
            .attr('stroke', resultColor).attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseover', (event) => {
              tt.html(`<strong>${resultLabels[result]} — ${colorLabels[color]}</strong><br/>
                ${t('charts.avgTimeRemaining')}: <span style="color:${resultColor}">${d.avgPct}%</span><br/>
                ${t('charts.gamesLabel')}: ${d.count}`)
                .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
            })
            .on('mousemove', (event) => tt.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`))
            .on('mouseout', () => tt.style('opacity', '0'));

          // Value label
          if (barH > 14) {
            g.append('text').attr('x', x0 + barW / 2).attr('y', y(d.avgPct) + 12).attr('text-anchor', 'middle')
              .style('font-size', '9px').style('fill', '#0f172a').style('font-weight', '600').text(`${d.avgPct}%`);
          }
        });
      });

      // X axis
      g.append('g').attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xOuter).tickFormat(r => resultLabels[r]))
        .selectAll('text').style('font-size', '11px').style('fill', '#94a3b8');

      // Y axis
      g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.selectAll('.domain').style('stroke', '#334155');

      // Legend (colors)
      const legG = svg.append('g').attr('transform', `translate(${ml},${height - 14})`);
      COLOR_ORDER.forEach((c, i) => {
        const lx = i * 90;
        legG.append('rect').attr('x', lx).attr('y', -12).attr('width', 9).attr('height', 9).attr('fill', colorFills[c]).attr('rx', 2).attr('stroke', '#94a3b8').attr('stroke-width', 0.5);
        legG.append('text').attr('x', lx + 13).attr('y', -4).style('font-size', '10px').style('fill', '#94a3b8').text(colorLabels[c]);
      });

      // Y axis label
      svg.append('text').attr('transform', 'rotate(-90)').attr('x', -(mt + iH / 2)).attr('y', 14)
        .attr('text-anchor', 'middle').style('font-size', '10px').style('fill', '#94a3b8')
        .text(t('charts.timeRemainingPct'));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  const empty = !data || data.length === 0;
  return (
    <div className="chart-card">
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>{t('charts.timeAnalysis')}</h4>
      {empty
        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '1.25rem' }}>
            {t('charts.noTimeData')}
          </div>
        : <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      }
    </div>
  );
}
