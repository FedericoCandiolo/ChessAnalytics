import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { RESULT_COLORS } from '../constants';
import { Maximize2, X } from 'lucide-react';

// Map result key to RESULT_COLORS key
const RESULT_COLOR_MAP = {
  victoria: RESULT_COLORS.win,
  tablas:   RESULT_COLORS.draw,
  derrota:  RESULT_COLORS.loss,
};

// Compute linear regression slope and intercept
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const [x, y] of points) {
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function AccuracyVsEloScatter({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef   = useRef(null);
  const [maximized, setMaximized] = useState(false);

  const hasData = Array.isArray(data) && data.length > 0;

  // Create tooltip once
  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position',       'fixed')
      .style('background',     'rgba(10,11,14,0.97)')
      .style('border',         '1px solid #334155')
      .style('border-radius',  '8px')
      .style('padding',        '10px 14px')
      .style('font-size',      '12px')
      .style('color',          '#E5E7E9')
      .style('pointer-events', 'none')
      .style('opacity',        '0')
      .style('z-index',        '10001')
      .style('min-width',      '160px')
      .style('line-height',    '1.7');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasData) return;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      d3.select(container).selectAll('*').remove();

      const ml = 42, mr = 14, mt = 16, mb = 44;
      const iW = width  - ml - mr;
      const iH = height - mt - mb;

      const svg = d3.select(container).append('svg')
        .attr('width',  width)
        .attr('height', height)
        .style('font-family', 'Inter, sans-serif');

      const g  = svg.append('g').attr('transform', `translate(${ml},${mt})`);
      const tt = tooltipRef.current;

      // ── Scales ──────────────────────────────────────────────
      const eloExtent = d3.extent(data, d => d.elo);
      const eloPad    = (eloExtent[1] - eloExtent[0]) * 0.05 || 20;

      const x = d3.scaleLinear()
        .domain([eloExtent[0] - eloPad, eloExtent[1] + eloPad])
        .range([0, iW])
        .nice();

      const y = d3.scaleLinear()
        .domain([0, 100])
        .range([iH, 0]);

      // ── Grid lines ──────────────────────────────────────────
      g.append('g')
        .attr('class', 'grid-x')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(x).tickSize(-iH).tickFormat('').ticks(6))
        .selectAll('line')
        .style('stroke', '#2d333f')
        .style('stroke-dasharray', '3,4')
        .style('stroke-opacity', '0.6');
      g.select('.grid-x .domain').remove();

      g.append('g')
        .attr('class', 'grid-y')
        .call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(5))
        .selectAll('line')
        .style('stroke', '#2d333f')
        .style('stroke-dasharray', '3,4')
        .style('stroke-opacity', '0.6');
      g.select('.grid-y .domain').remove();

      // ── Axes ────────────────────────────────────────────────
      const xAxis = g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(x).ticks(6));
      xAxis.selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      xAxis.select('.domain').style('stroke', '#2d333f');
      xAxis.selectAll('.tick line').style('stroke', '#2d333f');

      const yAxis = g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`));
      yAxis.selectAll('text').style('font-size', '10px').style('fill', '#64748b');
      yAxis.select('.domain').style('stroke', '#2d333f');
      yAxis.selectAll('.tick line').style('stroke', '#2d333f');

      // Axis labels
      g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + mb - 6)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#94a3b8')
        .text(t('charts.scatterEloAxis'));

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(iH / 2))
        .attr('y', -ml + 12)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#94a3b8')
        .text(t('charts.scatterAccAxis'));

      // ── Regression lines ────────────────────────────────────
      const results = ['victoria', 'tablas', 'derrota'];
      const [xMin, xMax] = x.domain();

      results.forEach(result => {
        const pts = data
          .filter(d => d.result === result && d.elo != null && d.accuracy != null)
          .map(d => [d.elo, d.accuracy]);

        if (pts.length < 2) return;

        const reg = linearRegression(pts);
        if (!reg) return;

        const { slope, intercept } = reg;
        const color = RESULT_COLOR_MAP[result] || '#94a3b8';

        const x1v = xMin;
        const x2v = xMax;
        const y1v = slope * x1v + intercept;
        const y2v = slope * x2v + intercept;

        // Clamp Y to [0, 100]
        const clampY = v => Math.max(0, Math.min(100, v));

        g.append('line')
          .attr('class', `trend-${result}`)
          .attr('x1', x(x1v)).attr('y1', y(clampY(y1v)))
          .attr('x2', x(x2v)).attr('y2', y(clampY(y2v)))
          .style('stroke',           color)
          .style('stroke-width',     1.5)
          .style('stroke-dasharray', '5,4')
          .style('stroke-opacity',   0.55);
      });

      // ── Dots ────────────────────────────────────────────────
      const resultLabel = result => {
        if (result === 'victoria') return t('results.wins');
        if (result === 'tablas')   return t('results.drawsLabel');
        return t('results.losses');
      };

      const colorLabel = color =>
        color === 'white' ? t('colorLabels.white') : t('colorLabels.black');

      g.selectAll('.scatter-dot')
        .data(data)
        .join('circle')
        .attr('class',  'scatter-dot')
        .attr('cx',     d => x(d.elo))
        .attr('cy',     d => y(d.accuracy))
        .attr('r',      5)
        .attr('fill',   d => RESULT_COLOR_MAP[d.result] || '#94a3b8')
        .attr('fill-opacity', 0)
        .attr('stroke',       '#0a0b0e')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .transition()
        .delay((_, i) => i * 10)
        .duration(300)
        .ease(d3.easeCubicOut)
        .attr('fill-opacity', d => d.color === 'white' ? 0.85 : 0.5)
        .attr('r', 5);

      // Interaction layer (add events after transition so they work immediately)
      g.selectAll('.scatter-dot')
        .on('mouseover', function(event, d) {
          d3.select(this)
            .raise()
            .attr('stroke', '#E5E7E9')
            .attr('stroke-width', 1.5);

          const color = RESULT_COLOR_MAP[d.result] || '#94a3b8';
          tt.html(`
            <span style="font-size:10px;color:#64748b;">${d.opponent || ''}${d.opponentRating ? ` (${d.opponentRating})` : ''}</span>
            <hr style="border:none;border-top:1px solid #2d333f;margin:5px 0;"/>
            <span style="color:${color};font-weight:700;">${resultLabel(d.result)}</span>
            <br/>
            <span style="color:#94a3b8;font-size:11px;">${t('charts.scatterEloAxis')}: </span><strong>${d.elo}</strong>
            <br/>
            <span style="color:#94a3b8;font-size:11px;">${t('charts.scatterAccAxis').replace(' (%)', '')}: </span><strong>${d.accuracy}%</strong>
            <br/>
            <span style="color:#94a3b8;font-size:11px;">${colorLabel(d.color)}</span>
          `)
            .style('opacity', '1')
            .style('left',   `${event.clientX + 14}px`)
            .style('top',    `${event.clientY - 14}px`);
        })
        .on('mousemove', event => {
          tt.style('left', `${event.clientX + 14}px`)
            .style('top',  `${event.clientY - 14}px`);
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .attr('stroke',       '#0a0b0e')
            .attr('stroke-width', 1);
          tt.style('opacity', '0');
        });

      // ── Legend ──────────────────────────────────────────────
      // Legend area placed below the chart (inside the SVG bottom margin)
      const legY   = height - 10;
      const legG   = svg.append('g').attr('transform', `translate(${ml},${legY})`);

      // Result legend entries
      const resultEntries = [
        { key: 'victoria', label: t('results.wins') },
        { key: 'tablas',   label: t('results.drawsLabel') },
        { key: 'derrota',  label: t('results.losses') },
      ];

      let cursor = 0;
      resultEntries.forEach(({ key, label }) => {
        const col = RESULT_COLOR_MAP[key];
        legG.append('circle')
          .attr('cx', cursor + 5).attr('cy', -4).attr('r', 5)
          .attr('fill', col).attr('fill-opacity', 0.85)
          .attr('stroke', '#0a0b0e').attr('stroke-width', 1);
        const textNode = legG.append('text')
          .attr('x', cursor + 14).attr('y', 0)
          .style('font-size', '10px').style('fill', '#94a3b8')
          .text(label);
        cursor += 14 + textNode.node().getComputedTextLength() + 12;
      });

      // Opacity indicator: white vs black
      cursor += 4;
      // White dot
      legG.append('circle')
        .attr('cx', cursor + 5).attr('cy', -4).attr('r', 5)
        .attr('fill', '#94a3b8').attr('fill-opacity', 0.85)
        .attr('stroke', '#0a0b0e').attr('stroke-width', 1);
      const whiteText = legG.append('text')
        .attr('x', cursor + 14).attr('y', 0)
        .style('font-size', '10px').style('fill', '#64748b')
        .text(t('colorLabels.white'));
      cursor += 14 + whiteText.node().getComputedTextLength() + 10;

      // Black dot
      legG.append('circle')
        .attr('cx', cursor + 5).attr('cy', -4).attr('r', 5)
        .attr('fill', '#94a3b8').attr('fill-opacity', 0.5)
        .attr('stroke', '#0a0b0e').attr('stroke-width', 1);
      legG.append('text')
        .attr('x', cursor + 14).attr('y', 0)
        .style('font-size', '10px').style('fill', '#64748b')
        .text(t('colorLabels.black'));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => {
      ro.disconnect();
      d3.select(container).selectAll('*').remove();
    };
  }, [data, hasData, t, maximized]);

  const card = (
    <div className={`chart-card${maximized ? ' chart-card--max' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{t('charts.scatterTitle')}</h4>
        <button className="chart-max-btn" style={{ opacity: 1 }} onClick={() => setMaximized(m => !m)}>
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {hasData
        ? <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
        : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '0.75rem',
            textAlign: 'center',
            padding: '1.25rem',
          }}>
            {t('charts.scatterNoData')}
          </div>
        )
      }
    </div>
  );

  if (maximized) {
    return createPortal(
      <div
        className="chart-max-overlay"
        onClick={e => { if (e.target === e.currentTarget) setMaximized(false); }}
      >
        {card}
      </div>,
      document.body
    );
  }

  return card;
}
