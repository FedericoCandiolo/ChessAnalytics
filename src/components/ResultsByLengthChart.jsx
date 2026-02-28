import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';

export default function ResultsByLengthChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position', 'fixed').style('background', 'rgba(10,11,14,0.97)')
      .style('border', '1px solid #334155').style('border-radius', '8px')
      .style('padding', '10px 14px').style('font-size', '12px').style('color', '#fff')
      .style('pointer-events', 'none').style('opacity', '0').style('z-index', '9999')
      .style('line-height', '1.7');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length === 0) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 42, mr = 14, mt = 14, mb = 52;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      // Use absolute counts
      const keys = ['victorias', 'tablas', 'derrotas'];
      const colors = [RESULT_COLORS.win, RESULT_COLORS.draw, RESULT_COLORS.loss];
      const names = [t('results.wins'), t('results.drawsLabel'), t('results.losses')];

      const x = d3.scaleBand().domain(data.map(d => d.bucket)).range([0, iW]).padding(0.22);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total) * 1.12]).range([iH, 0]);

      // Grid
      g.append('g').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(5))
        .selectAll('line').style('stroke', '#1e2533').style('stroke-dasharray', '2,4');
      g.select('.domain').remove();

      // Stacked bars with animation
      const stack = d3.stack().keys(keys);
      const series = stack(data);

      series.forEach((layer, li) => {
        g.selectAll(`.bar-${li}`).data(layer).join('rect')
          .attr('class', `bar-${li}`)
          .attr('x', d => x(d.data.bucket))
          .attr('width', x.bandwidth())
          .attr('fill', colors[li])
          .attr('rx', li === 0 ? 4 : 0)
          .attr('ry', li === 0 ? 4 : 0)
          // Animate from bottom
          .attr('y', iH).attr('height', 0)
          .transition().duration(600).delay((_, i) => i * 60).ease(d3.easeCubicOut)
          .attr('y', d => y(d[1]))
          .attr('height', d => Math.max(0, y(d[0]) - y(d[1])));
      });

      // Transparent overlay for hover (on top of all bars)
      g.selectAll('.hover-rect').data(data).join('rect').attr('class', 'hover-rect')
        .attr('x', d => x(d.bucket)).attr('y', 0)
        .attr('width', x.bandwidth()).attr('height', iH)
        .attr('fill', 'transparent').style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill', 'rgba(255,255,255,0.04)');
          const winPct = d.total > 0 ? Math.round(d.victorias / d.total * 100) : 0;
          const drawPct = d.total > 0 ? Math.round(d.tablas / d.total * 100) : 0;
          const lossPct = d.total > 0 ? Math.round(d.derrotas / d.total * 100) : 0;
          tt.html(`<strong>${t('charts.moves')}: ${d.bucket}</strong>
            <hr style="border:none;border-top:1px solid #2d333f;margin:5px 0;"/>
            ${t('charts.gamesLabel')}: <strong>${d.total}</strong><br/>
            <span style="color:${RESULT_COLORS.win}">▮ ${t('results.wins')}: ${d.victorias} (${winPct}%)</span><br/>
            <span style="color:${RESULT_COLORS.draw}">▮ ${t('results.drawsLabel')}: ${d.tablas} (${drawPct}%)</span><br/>
            <span style="color:${RESULT_COLORS.loss}">▮ ${t('results.losses')}: ${d.derrotas} (${lossPct}%)</span>`)
            .style('opacity', '1').style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
        })
        .on('mousemove', (event) => tt.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`))
        .on('mouseout', function() {
          d3.select(this).attr('fill', 'transparent');
          tt.style('opacity', '0');
        });

      // Total labels above bars
      g.selectAll('.total-lbl').data(data).join('text').attr('class', 'total-lbl')
        .attr('x', d => x(d.bucket) + x.bandwidth() / 2).attr('text-anchor', 'middle')
        .attr('y', 0).attr('opacity', 0)
        .style('font-size', '10px').style('fill', '#94a3b8').text(d => d.total)
        .transition().duration(600).delay((_, i) => i * 60 + 400)
        .attr('y', d => y(d.total) - 4).attr('opacity', 1);

      // Axes
      g.append('g').attr('transform', `translate(0,${iH})`).call(d3.axisBottom(x))
        .selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${d/1000}k` : d))
        .selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      g.selectAll('.domain').style('stroke', '#2d333f');

      // X label
      svg.append('text').attr('x', ml + iW / 2).attr('y', height - 10).attr('text-anchor', 'middle')
        .style('font-size', '10px').style('fill', '#64748b').text(t('charts.movesXLabel'));

      // Legend
      const legG = svg.append('g').attr('transform', `translate(${ml},${height - 24})`);
      keys.forEach((_, i) => {
        const lx = i * 88;
        legG.append('rect').attr('x', lx).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', colors[i]).attr('rx', 2);
        legG.append('text').attr('x', lx + 14).attr('y', 9).style('font-size', '10px').style('fill', '#94a3b8').text(names[i]);
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  return (
    <div className="chart-card">
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>{t('charts.resultsByLength')}</h4>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
