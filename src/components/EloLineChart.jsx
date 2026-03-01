import React, { useRef, useEffect, useState } from 'react';

import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { ELO_COLORS } from '../constants';
import { Maximize2, X } from 'lucide-react';

const TIME_CLASSES = ['rapid', 'blitz', 'bullet', 'daily'];

export default function EloLineChart({ data }) {
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
      .style('min-width', '140px').style('line-height', '1.6');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length < 2) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 46, mr = 14, mt = 16, mb = 42;
      const iW = width - ml - mr;
      const iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g   = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt  = tooltipRef.current;

      const presentTCs = TIME_CLASSES.filter(tc => data.some(d => d[tc] !== undefined));
      if (presentTCs.length === 0) return;

      // Per-TC filtered arrays (for connected lines, no gaps)
      const tcArrays = {};
      const modeStats = {};
      presentTCs.forEach(tc => {
        tcArrays[tc] = data.filter(d => d[tc] !== undefined && d[tc] !== null);
        const vals = tcArrays[tc].map(d => d[tc]);
        modeStats[tc] = { min: Math.min(...vals), max: Math.max(...vals), final: vals[vals.length - 1] };
      });

      // Y domain covers mins and maxes (for band)
      const allVals = presentTCs.flatMap(tc => tcArrays[tc].flatMap(d => [d[tc], d[`${tc}_min`] ?? d[tc], d[`${tc}_max`] ?? d[tc]]));
      const [vMin, vMax] = d3.extent(allVals.filter(v => v !== undefined));

      const toDate = d => d.dateObj instanceof Date ? d.dateObj : new Date(d.dateObj);
      const x = d3.scaleTime().domain(d3.extent(data, toDate)).range([0, iW]);
      const y = d3.scaleLinear().domain([vMin - 30, vMax + 30]).range([iH, 0]);

      // Grid
      g.append('g').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(5))
        .selectAll('line').style('stroke', '#1e2533').style('stroke-dasharray', '2,4');
      g.select('.domain').remove();

      // Axes
      g.append('g').attr('transform', `translate(0,${iH})`).call(
        d3.axisBottom(x).ticks(width < 500 ? 4 : 6).tickFormat(d3.timeFormat('%b %y'))
      ).selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      g.append('g').call(d3.axisLeft(y).ticks(5))
        .selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      g.selectAll('.domain').style('stroke', '#2d333f');

      // Lines + bands per TC
      presentTCs.forEach(tc => {
        const tcData = tcArrays[tc];
        if (tcData.length === 0) return;
        const col = ELO_COLORS[tc];

        // Min-max band (if we have band data)
        const hasBand = tcData.some(d => d[`${tc}_min`] !== undefined);
        if (hasBand) {
          const bandArea = d3.area()
            .defined(d => d[`${tc}_min`] !== undefined && d[`${tc}_max`] !== undefined)
            .x(d => x(toDate(d)))
            .y0(d => y(d[`${tc}_min`] ?? d[tc]))
            .y1(d => y(d[`${tc}_max`] ?? d[tc]))
            .curve(d3.curveMonotoneX);
          g.append('path').datum(tcData).attr('fill', col).attr('opacity', 0.15).attr('d', bandArea);
        }

        const lineGen = d3.line().x(d => x(toDate(d))).y(d => y(d[tc])).curve(d3.curveMonotoneX);

        // Line with draw animation
        const path = g.append('path').datum(tcData)
          .attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round').attr('d', lineGen);
        const totalLength = path.node().getTotalLength();
        path.attr('stroke-dasharray', totalLength).attr('stroke-dashoffset', totalLength)
          .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

        // Dots
        g.selectAll(`.dot-${tc}`).data(tcData).join('circle').attr('class', `dot-${tc}`)
          .attr('cx', d => x(toDate(d))).attr('cy', d => y(d[tc]))
          .attr('r', 3).attr('fill', col).attr('stroke', '#0a0b0e').attr('stroke-width', 1.5)
          .attr('opacity', 0).transition().delay(900).attr('opacity', 1);
      });

      // Crosshair + tooltip
      const crossV = g.append('line').attr('y1', 0).attr('y2', iH)
        .attr('stroke', '#475569').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', 0);

      const bisect = d3.bisector(toDate).left;

      svg.append('rect').attr('x', ml).attr('y', mt).attr('width', iW).attr('height', iH)
        .attr('fill', 'none').attr('pointer-events', 'all')
        .on('mousemove', (event) => {
          const [mx, myRaw] = d3.pointer(event, svg.node());
          const myAdj = myRaw - mt;
          const x0 = x.invert(mx - ml);
          const i = bisect(data, x0, 1);
          const dL = data[Math.max(0, i - 1)];
          const dR = data[Math.min(data.length - 1, i)];
          const d  = (x0 - toDate(dL)) < (toDate(dR) - x0) ? dL : dR;
          if (!d) return;

          crossV.attr('x1', x(toDate(d))).attr('x2', x(toDate(d))).attr('opacity', 1);

          let closestTC = null, closestDist = Infinity;
          presentTCs.forEach(tc => {
            if (d[tc] === undefined) return;
            const dist = Math.abs(myAdj - y(d[tc]));
            if (dist < closestDist) { closestDist = dist; closestTC = tc; }
          });

          let html = `<span style="font-size:11px;color:#64748b;">${d.name}</span>`;
          if (closestTC && d[closestTC] !== undefined) {
            const s   = modeStats[closestTC];
            const col = ELO_COLORS[closestTC];
            const mn  = d[`${closestTC}_min`];
            const mx2 = d[`${closestTC}_max`];
            html += `<hr style="border:none;border-top:1px solid #2d333f;margin:5px 0;"/>
              <span style="color:${col};font-weight:700;font-size:13px;">
                ${t(`timeClasses.${closestTC}`, closestTC)}: ${d[closestTC]}
              </span>`;
            if (mn !== undefined && mx2 !== undefined && mn !== mx2) {
              html += `<br/><span style="font-size:10px;color:#64748b;">⬇ ${mn} · ⬆ ${mx2}</span>`;
            }
            html += `<br/><span style="font-size:10px;color:#94a3b8;">
              ↓ min ${s.min} &nbsp;·&nbsp; ↑ max ${s.max} &nbsp;·&nbsp; → ${s.final}
            </span>`;
          }
          const others = presentTCs.filter(tc => tc !== closestTC && d[tc] !== undefined);
          if (others.length) {
            html += `<hr style="border:none;border-top:1px solid #2d333f;margin:5px 0;"/>`;
            others.forEach(tc => {
              html += `<span style="color:${ELO_COLORS[tc]};font-size:11px;">${t(`timeClasses.${tc}`, tc)}: ${d[tc]}</span><br/>`;
            });
          }

          tt.html(html).style('opacity', '1')
            .style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
        })
        .on('mouseout', () => { crossV.attr('opacity', 0); tt.style('opacity', '0'); });

      // Legend
      const legG = svg.append('g').attr('transform', `translate(${ml},${height - 4})`);
      presentTCs.forEach((tc, i) => {
        const lx = i * 85;
        legG.append('line').attr('x1', lx).attr('x2', lx + 14).attr('y1', -12).attr('y2', -12)
          .attr('stroke', ELO_COLORS[tc]).attr('stroke-width', 2.5).attr('stroke-linecap', 'round');
        legG.append('circle').attr('cx', lx + 7).attr('cy', -12).attr('r', 3).attr('fill', ELO_COLORS[tc]);
        legG.append('text').attr('x', lx + 19).attr('y', -8).style('font-size', '10px').style('fill', '#94a3b8')
          .text(t(`timeClasses.${tc}`, tc));
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
      <div className={`chart-card chart-card-elo${maximized ? ' chart-card--max' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.eloEvolution')}</h4>
          <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
            {maximized ? <X size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
        <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      </div>
    </>
  );
}
