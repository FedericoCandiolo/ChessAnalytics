import React, { useRef, useEffect, useState } from 'react';

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
      const width = container.clientWidth;
      if (!width) return;
      d3.select(container).selectAll('*').remove();

      const barH = 22;
      const ml = 130, mr = 56, mt = 8, mb = 32;
      const innerW = Math.max(10, width - ml - mr);
      const totalGames = d3.sum(data, d => d.total);
      const N = data.length;
      const innerH = N * barH;
      const svgH = innerH + mt + mb;

      const svg = d3.select(container).append('svg').attr('width', width).attr('height', svgH).style('overflow', 'hidden');
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const x    = d3.scaleLinear().domain([0, d3.max(data, d => d.total)]).range([0, innerW]);
      const y    = d3.scaleBand().domain(data.map(d => d.name)).range([0, innerH]).padding(0.25);

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

      // Pareto border: green outline on bars within Pareto equilibrium
      let cumGames = 0;
      data.forEach((d, i) => {
        cumGames += d.total;
        const inPareto = ((i + 1) / N) + (cumGames / (totalGames || 1)) <= 1.0;
        if (inPareto) {
          g.append('rect')
            .attr('x', 0).attr('y', y(d.name))
            .attr('width', x(d.total)).attr('height', y.bandwidth())
            .attr('fill', 'none')
            .attr('stroke', RESULT_COLORS.win)
            .attr('stroke-width', 1.5)
            .attr('rx', 3)
            .attr('pointer-events', 'none')
            .attr('opacity', 0)
            .transition().duration(400).delay(i * 25 + 300).attr('opacity', 0.8);
        }
      });

      // Total count labels
      g.selectAll('.lbl').data(data).join('text').attr('class', 'lbl')
        .attr('x', d => x(d.total) + 4).attr('y', d => y(d.name) + y.bandwidth() / 2 + 1)
        .attr('dy', '0.35em').style('font-size', '9px').style('fill', '#94a3b8').text(d => d.total);

      // Y axis (opening names)
      const axisG = g.append('g').call(d3.axisLeft(y).tickSize(0));
      axisG.selectAll('text')
        .style('font-size', '9px').style('fill', '#94a3b8')
        .style('pointer-events', 'all').style('cursor', 'default')
        .each(function() {
          const el = d3.select(this);
          const fullName = el.text();
          const item = data.find(d => d.name === fullName);
          el.text(fullName.length > 22 ? fullName.slice(0, 21) + '…' : fullName);
          if (!item) return;
          const familyLabel = t(`ecoFamilies.${item.family}`, item.family);
          el.on('mouseover', (event) => {
            tt.html(
              `<strong style="color:#E5E7E9;display:block;margin-bottom:3px">${fullName}</strong>` +
              `<span style="color:#64748b;font-size:10px">${familyLabel}</span>`
            ).style('opacity', '1')
              .style('left', `${event.clientX + 14}px`)
              .style('top', `${event.clientY - 14}px`);
          })
          .on('mousemove', (event) => {
            tt.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
          })
          .on('mouseout', () => tt.style('opacity', '0'));
        });
      axisG.select('.domain').remove();

      // Legend — item width adapts to available space so nothing overflows the SVG
      const legAvailW = width - ml;
      const legItemW = Math.min(78, Math.floor(legAvailW / 3.5));
      const legG = svg.append('g').attr('transform', `translate(${ml},${svgH - 4})`);
      colors.forEach((c, i) => {
        const lx = i * legItemW;
        legG.append('rect').attr('x', lx).attr('y', -14).attr('width', 8).attr('height', 8).attr('fill', c).attr('rx', 2);
        legG.append('text').attr('x', lx + 11).attr('y', -7).style('font-size', '9px').style('fill', '#94a3b8').text(names[i]);
      });
      // Pareto legend entry — only shown when there is enough horizontal room
      const px = 3 * legItemW;
      if (ml + px + 80 <= width) {
        legG.append('rect').attr('x', px).attr('y', -14).attr('width', 14).attr('height', 8)
          .attr('fill', 'none').attr('stroke', RESULT_COLORS.win).attr('stroke-width', 1.5).attr('rx', 2);
        legG.append('text').attr('x', px + 18).attr('y', -7).style('font-size', '9px').style('fill', '#94a3b8').text(t('charts.paretoIn'));
      }
    };

    draw();
    const ro = new ResizeObserver(() => requestAnimationFrame(draw));
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  return (
    <>
      {maximized && <div className="chart-max-overlay" onClick={() => setMaximized(false)} />}
      <div className={`chart-card${maximized ? ' chart-card--max' : ''}`} data-chart="openings" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.openingSuccess')}</h4>
          <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
            {maximized ? <X size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }} ref={containerRef} />
      </div>
    </>
  );
}
