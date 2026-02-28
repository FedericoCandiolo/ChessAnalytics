import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';
import { Maximize2, X } from 'lucide-react';

export default function OpeningsBarChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position', 'fixed').style('background', 'rgba(10,11,14,0.97)')
      .style('border', '1px solid #334155').style('border-radius', '8px')
      .style('padding', '10px 14px').style('font-size', '12px').style('color', '#fff')
      .style('pointer-events', 'none').style('opacity', '0').style('z-index', '10001')
      .style('line-height', '1.7');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length === 0) return;

    const draw = () => {
      const { width } = container.getBoundingClientRect();
      if (!width) return;
      d3.select(container).selectAll('*').remove();

      const barH = 22;
      const ml = 130, mr = 56, mt = 8, mb = 32;
      const innerW = Math.max(10, width - ml - mr);
      const totalGames = d3.sum(data, d => d.total);
      const N = data.length;
      const innerH = N * barH;
      const svgH = innerH + mt + mb;

      const svg = d3.select(container).append('svg').attr('width', width).attr('height', svgH);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const x    = d3.scaleLinear().domain([0, d3.max(data, d => d.total)]).range([0, innerW]);
      const y    = d3.scaleBand().domain(data.map(d => d.name)).range([0, innerH]).padding(0.25);
      const xCum = d3.scaleLinear().domain([0, 100]).range([0, innerW]);

      const stack  = d3.stack().keys(['victoria', 'tablas', 'derrota']);
      const colors = [RESULT_COLORS.win, RESULT_COLORS.draw, RESULT_COLORS.loss];
      const names  = [t('results.wins'), t('results.drawsLabel'), t('results.losses')];

      // Stacked bars with animation
      stack(data).forEach((layer, li) => {
        g.selectAll(`.bar-${li}`).data(layer).join('rect')
          .attr('class', `bar-${li}`)
          .attr('x', d => x(d[0])).attr('y', d => y(d.data.name))
          .attr('width', 0)
          .attr('height', y.bandwidth())
          .attr('fill', colors[li])
          .attr('rx', li === 2 ? 3 : 0)
          .style('cursor', 'pointer')
          .on('mouseover', (event, d) => {
            const wp = d.data.total > 0 ? Math.round(d.data.victoria / d.data.total * 100) : 0;
            const dp = d.data.total > 0 ? Math.round(d.data.tablas   / d.data.total * 100) : 0;
            const lp = d.data.total > 0 ? Math.round(d.data.derrota  / d.data.total * 100) : 0;
            tt.html(`<strong>${d.data.name.length > 40 ? d.data.name.slice(0,39)+'…' : d.data.name}</strong>
              <hr style="border:none;border-top:1px solid #2d333f;margin:4px 0"/>
              <span style="color:${RESULT_COLORS.win}">▮ ${t('results.wins')}: ${d.data.victoria} (${wp}%)</span><br/>
              <span style="color:${RESULT_COLORS.draw}">▮ ${t('results.drawsLabel')}: ${d.data.tablas} (${dp}%)</span><br/>
              <span style="color:${RESULT_COLORS.loss}">▮ ${t('results.losses')}: ${d.data.derrota} (${lp}%)</span><br/>
              ${t('charts.gamesLabel')}: <strong>${d.data.total}</strong>`)
              .style('opacity', '1').style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
          })
          .on('mousemove', (event) => tt.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`))
          .on('mouseout', () => tt.style('opacity', '0'))
          .transition().duration(500).delay((_, i) => i * 25)
          .attr('width', d => Math.max(0, x(d[1]) - x(d[0])));
      });

      // Pareto indicators + cumulative line data
      let cumGames = 0;
      const cumPoints = [];
      data.forEach((d, i) => {
        cumGames += d.total;
        const cumPct   = totalGames > 0 ? (cumGames / totalGames) * 100 : 0;
        const inPareto = ((i + 1) / N) + (cumGames / (totalGames || 1)) <= 1.0;
        const cy = y(d.name) + y.bandwidth() / 2;
        cumPoints.push({ cumPct, cy, inPareto });

        // Left edge indicator stripe
        g.append('rect')
          .attr('x', -6).attr('y', y(d.name) + 2)
          .attr('width', 3).attr('height', y.bandwidth() - 4)
          .attr('fill', inPareto ? RESULT_COLORS.win : '#f97316')
          .attr('rx', 1).attr('opacity', 0.9);
      });

      // Cumulative step line
      const lineGen = d3.line().x(d => xCum(d.cumPct)).y(d => d.cy).curve(d3.curveStepAfter);
      const cumPath = g.append('path').datum(cumPoints)
        .attr('fill', 'none').attr('stroke', '#60a5fa')
        .attr('stroke-width', 1.5).attr('opacity', 0.75).attr('d', lineGen);

      const len = cumPath.node().getTotalLength();
      cumPath.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().duration(900).delay(400).ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0).attr('stroke-dasharray', '3,3');

      g.selectAll('.cum-dot').data(cumPoints).join('circle').attr('class', 'cum-dot')
        .attr('cx', d => xCum(d.cumPct)).attr('cy', d => d.cy)
        .attr('r', 0).attr('fill', '#60a5fa').attr('opacity', 0.85)
        .transition().duration(300).delay((_, i) => i * 25 + 800).attr('r', 2.5);

      // Total count labels
      g.selectAll('.lbl').data(data).join('text').attr('class', 'lbl')
        .attr('x', d => x(d.total) + 4).attr('y', d => y(d.name) + y.bandwidth() / 2 + 1)
        .attr('dy', '0.35em').style('font-size', '9px').style('fill', '#94a3b8').text(d => d.total);

      // Y axis (opening names)
      g.append('g').call(d3.axisLeft(y).tickSize(0))
        .selectAll('text').style('font-size', '9px').style('fill', '#94a3b8')
        .each(function() {
          const el = d3.select(this), txt = el.text();
          el.text(txt.length > 22 ? txt.slice(0, 21) + '…' : txt);
        });
      g.select('.domain').remove();

      // Right cumulative axis
      const axRight = g.append('g').attr('transform', `translate(${innerW},0)`)
        .call(d3.axisRight(xCum.copy().range([0, innerH])).ticks(4).tickFormat(d => `${d}%`));
      axRight.selectAll('text').style('font-size', '8px').style('fill', '#60a5fa');
      axRight.select('.domain').remove();
      axRight.selectAll('line').remove();

      // Legend
      const legG = svg.append('g').attr('transform', `translate(${ml},${svgH - 4})`);
      colors.forEach((c, i) => {
        const lx = i * 78;
        legG.append('rect').attr('x', lx).attr('y', -14).attr('width', 8).attr('height', 8).attr('fill', c).attr('rx', 2);
        legG.append('text').attr('x', lx + 11).attr('y', -7).style('font-size', '9px').style('fill', '#94a3b8').text(names[i]);
      });
      const px = 3 * 78;
      legG.append('rect').attr('x', px).attr('y', -13).attr('width', 3).attr('height', 8).attr('fill', RESULT_COLORS.win).attr('rx', 1);
      legG.append('text').attr('x', px + 7).attr('y', -7).style('font-size', '9px').style('fill', '#94a3b8').text(t('charts.paretoIn'));
      legG.append('line').attr('x1', px + 90).attr('x2', px + 102).attr('y1', -9).attr('y2', -9)
        .attr('stroke', '#60a5fa').attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2');
      legG.append('text').attr('x', px + 105).attr('y', -7).style('font-size', '9px').style('fill', '#60a5fa').text(t('charts.cumulative'));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  const card = (
    <div className={`chart-card${maximized ? ' chart-card--max' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.openingSuccess')}</h4>
        <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} ref={containerRef} />
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
