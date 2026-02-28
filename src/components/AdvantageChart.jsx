import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';

export default function AdvantageChart({ data }) {
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
    if (!container || !data || data.length < 3) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 42, mr = 14, mt = 14, mb = 40;
      const iW = width - ml - mr, iH = height - mt - mb;
      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      const xExt = d3.extent(data, d => d.ply);
      const yExt = d3.extent(data, d => d.avgEval);
      const yPad = Math.max(0.5, Math.abs(yExt[1] - yExt[0]) * 0.15);
      const yMin = Math.min(yExt[0] - yPad, -0.3);
      const yMax = Math.max(yExt[1] + yPad, 0.3);

      const x = d3.scaleLinear().domain(xExt).range([0, iW]);
      const y = d3.scaleLinear().domain([yMin, yMax]).range([iH, 0]);
      const y0 = y(0);

      // Background bands: green above 0, red below 0
      const clipAbove = svg.append('defs').append('clipPath').attr('id', `clip-above-${Date.now()}`);
      clipAbove.append('rect').attr('x', ml).attr('y', mt).attr('width', iW).attr('height', Math.max(0, y0));

      const clipBelow = svg.append('defs').append('clipPath').attr('id', `clip-below-${Date.now() + 1}`);
      clipBelow.append('rect').attr('x', ml).attr('y', mt + y0).attr('width', iW).attr('height', Math.max(0, iH - y0));

      const areaAbove = d3.area().x(d => x(d.ply)).y0(y0).y1(d => y(d.ma)).curve(d3.curveMonotoneX);
      const areaBelow = d3.area().x(d => x(d.ply)).y0(y0).y1(d => y(d.ma)).curve(d3.curveMonotoneX);

      g.append('path').datum(data).attr('fill', '#00FF9C').attr('opacity', 0.12).attr('d', areaAbove);
      g.append('path').datum(data).attr('fill', '#FF0101').attr('opacity', 0.12).attr('d', areaBelow);

      // Zero line
      g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', y0).attr('y2', y0)
        .attr('stroke', '#4b5563').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

      // Grid
      g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(5))
        .selectAll('line').style('stroke', '#2d333f').style('stroke-dasharray', '3,3');
      g.select('.grid .domain').remove();

      // Raw average line (faded)
      const lineRaw = d3.line().x(d => x(d.ply)).y(d => y(d.avgEval)).curve(d3.curveMonotoneX);
      g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#01B6FF').attr('stroke-width', 1)
        .attr('opacity', 0.35).attr('d', lineRaw);

      // Moving average line
      const lineMA = d3.line().x(d => x(d.ply)).y(d => y(d.ma)).curve(d3.curveMonotoneX);
      g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#01B6FF').attr('stroke-width', 2.5).attr('d', lineMA);

      // Axes
      const tickStep = Math.max(2, Math.ceil(data.length / 10));
      g.append('g').attr('transform', `translate(0,${iH})`).call(
        d3.axisBottom(x).tickValues(data.filter((_, i) => i % tickStep === 0).map(d => d.ply))
          .tickFormat(d => `${Math.floor(d / 2) + 1}`)
      ).selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)))
        .selectAll('text').style('font-size', '10px').style('fill', '#94a3b8');
      g.selectAll('.domain').style('stroke', '#334155');

      // X axis label
      svg.append('text').attr('x', ml + iW / 2).attr('y', height - 6).attr('text-anchor', 'middle')
        .style('font-size', '10px').style('fill', '#94a3b8').text(t('charts.moveNumber'));

      // Tooltip overlay
      const bisect = d3.bisector(d => d.ply).left;
      svg.append('rect').attr('x', ml).attr('y', mt).attr('width', iW).attr('height', iH)
        .attr('fill', 'none').attr('pointer-events', 'all')
        .on('mousemove', (event) => {
          const [mx] = d3.pointer(event, svg.node());
          const plyVal = x.invert(mx - ml);
          const i = bisect(data, plyVal, 1);
          const d = data[Math.max(0, Math.min(i, data.length - 1))];
          if (!d) return;
          const sign = d.ma >= 0 ? '+' : '';
          const color = d.ma >= 0 ? '#00FF9C' : '#FF0101';
          tt.html(`<strong>${t('charts.move')} ${d.move}</strong><br/>
            ${t('charts.movingAvg')}: <span style="color:${color}">${sign}${d.ma.toFixed(2)}</span><br/>
            ${t('charts.avgEval')}: ${sign}${d.avgEval.toFixed(2)}<br/>
            ${t('charts.gamesLabel')}: ${d.count}`)
            .style('opacity', '1').style('left', `${event.clientX + 12}px`).style('top', `${event.clientY - 8}px`);
        })
        .on('mouseout', () => tt.style('opacity', '0'));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => { ro.disconnect(); d3.select(container).selectAll('*').remove(); };
  }, [data, t]);

  const empty = !data || data.length < 3;
  return (
    <div className="chart-card">
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
        {t('charts.advantageOverGame')}
        <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.5rem', fontWeight: 'normal' }}>
          ({t('charts.movingAvgShort')})
        </span>
      </h4>
      {empty
        ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '1.25rem' }}>
            {t('charts.noEvalData')}
          </div>
        : <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      }
    </div>
  );
}
