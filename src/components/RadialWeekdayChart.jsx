import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { Maximize2, X } from 'lucide-react';

const N = 7;
const ACCENT = '#01B6FF';

export default function RadialWeekdayChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [maximized, setMaximized] = useState(false);

  // Create tooltip once on mount
  useEffect(() => {
    tooltipRef.current = d3.select('body').append('div')
      .style('position', 'fixed')
      .style('background', 'rgba(10,11,14,0.97)')
      .style('border', '1px solid #2d333f')
      .style('border-radius', '8px')
      .style('padding', '10px 14px')
      .style('font-size', '12px')
      .style('color', '#E5E7E9')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('z-index', '10001')
      .style('line-height', '1.8')
      .style('min-width', '170px');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const draw = () => {
      d3.select(container).selectAll('*').remove();

      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      // Square chart
      const size = Math.min(width, height);
      const labelPad = 32; // space for day labels
      const radius = size / 2 - labelPad;
      const midRadius = radius * 0.38; // maps to zero net score

      const angleSlice = (2 * Math.PI) / N;

      // Compute scale domain
      const maxAbsVal = Math.max(
        1,
        d3.max(data, d => Math.max(Math.abs(d.min), Math.abs(d.max))) || 1
      );

      // rScale: maps net score value → radial distance from center
      // 0 → midRadius, +maxAbsVal → radius, -maxAbsVal → 0
      const rScale = d3.scaleLinear()
        .domain([-maxAbsVal, 0, maxAbsVal])
        .range([0, midRadius, radius])
        .clamp(true);

      // Helpers: polar → cartesian (center is origin)
      const px = (val, i) => rScale(val) * Math.cos(i * angleSlice - Math.PI / 2);
      const py = (val, i) => rScale(val) * Math.sin(i * angleSlice - Math.PI / 2);

      // Build point arrays (close loop by repeating first element)
      const closed = (accessor) =>
        [...data, data[0]].map((d, i) => [px(accessor(d), i), py(accessor(d), i)]);

      const pts_median = closed(d => d.median);
      const pts_q1     = closed(d => d.q1);
      const pts_q3     = closed(d => d.q3);
      const pts_min    = closed(d => d.min);
      const pts_max    = closed(d => d.max);

      // Line generator (closed curve through all 8 points, last == first)
      const lineGen = d3.line()
        .x(d => d[0])
        .y(d => d[1])
        .curve(d3.curveCardinalClosed.tension(0.4));

      // Band area: polygon going forward along outer edge, backward along inner edge.
      const bandPath = (outerPts, innerPts) => {
        const fwd = outerPts.slice(0, N);
        const bwd = [...innerPts.slice(0, N)].reverse();
        return d3.line()
          .x(d => d[0])
          .y(d => d[1])
          .curve(d3.curveLinearClosed)([...fwd, ...bwd]);
      };

      // SVG setup
      const svg = d3.select(container)
        .append('svg')
        .attr('width', size)
        .attr('height', size)
        .style('display', 'block')
        .style('margin', '0 auto');

      svgRef.current = svg;

      const g = svg.append('g')
        .attr('transform', `translate(${size / 2}, ${size / 2})`);

      const tt = tooltipRef.current;

      // ── Grid circles ─────────────────────────────────────────────────────────

      // Outer grid rings (at 50% and 100% of outer zone)
      [0.5, 1].forEach(frac => {
        g.append('circle')
          .attr('r', midRadius + (radius - midRadius) * frac)
          .attr('fill', 'none')
          .attr('stroke', '#1e2533')
          .attr('stroke-width', 1);
      });

      // Zero circle (midRadius) – dashed
      g.append('circle')
        .attr('r', midRadius)
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 3');

      // Inner grid ring (halfway between center and zero)
      g.append('circle')
        .attr('r', midRadius * 0.5)
        .attr('fill', 'none')
        .attr('stroke', '#1e2533')
        .attr('stroke-width', 1);

      // ── Radial spoke lines ───────────────────────────────────────────────────
      data.forEach((_, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        g.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', radius * Math.cos(angle))
          .attr('y2', radius * Math.sin(angle))
          .attr('stroke', '#1e2533')
          .attr('stroke-width', 1);
      });

      // ── Area layers ──────────────────────────────────────────────────────────

      // 1. Outer range band (min to max) – 10% opacity
      g.append('path')
        .attr('d', bandPath(pts_max, pts_min))
        .attr('fill', ACCENT)
        .attr('fill-opacity', 0.10)
        .attr('stroke', 'none')
        .style('pointer-events', 'none');

      // 2. IQR band (q1 to q3) – 25% opacity
      g.append('path')
        .attr('d', bandPath(pts_q3, pts_q1))
        .attr('fill', ACCENT)
        .attr('fill-opacity', 0.25)
        .attr('stroke', 'none')
        .style('pointer-events', 'none');

      // 3. Median line – solid stroke
      g.append('path')
        .attr('d', lineGen(pts_median.slice(0, N)))
        .attr('fill', 'none')
        .attr('stroke', ACCENT)
        .attr('stroke-width', 2.5)
        .attr('stroke-opacity', 0.9)
        .attr('stroke-linejoin', 'round')
        .style('pointer-events', 'none');

      // Median dots at each weekday node
      data.forEach((d, i) => {
        g.append('circle')
          .attr('cx', px(d.median, i))
          .attr('cy', py(d.median, i))
          .attr('r', 3.5)
          .attr('fill', ACCENT)
          .attr('fill-opacity', 0.9)
          .style('pointer-events', 'none');
      });

      // ── Radial axis tick labels ───────────────────────────────────────────────
      // Show numeric tick labels along the top spoke (index 0, pointing up)
      const tickValues = [-maxAbsVal, 0, maxAbsVal];
      tickValues.forEach(val => {
        const r = rScale(val);
        const label = val > 0 ? `+${val}` : `${val}`;
        g.append('text')
          .attr('x', 4)
          .attr('y', -r + 4)
          .style('font-size', '9px')
          .style('fill', '#64748b')
          .style('pointer-events', 'none')
          .text(label);
      });

      // ── Day labels ───────────────────────────────────────────────────────────
      data.forEach((d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const labelR = radius + 18;
        const lx = labelR * Math.cos(angle);
        const ly = labelR * Math.sin(angle);

        g.append('text')
          .attr('x', lx)
          .attr('y', ly)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '11px')
          .style('font-weight', '600')
          .style('fill', '#E5E7E9')
          .style('pointer-events', 'none')
          .text(t(`weekdays.${d.weekday}`));
      });

      // ── Invisible hit-area wedges for tooltip ────────────────────────────────
      data.forEach((d, i) => {
        const startAngle = i * angleSlice - angleSlice / 2 - Math.PI / 2;
        const endAngle   = startAngle + angleSlice;

        const arc = d3.arc()
          .innerRadius(0)
          .outerRadius(radius)
          .startAngle(startAngle + Math.PI / 2)  // d3.arc uses 0=top
          .endAngle(endAngle + Math.PI / 2);

        const medDisplay = d.median >= 0 ? `+${d.median.toFixed(2)}` : d.median.toFixed(2);
        const q1Display  = d.q1 >= 0 ? `+${d.q1.toFixed(2)}` : d.q1.toFixed(2);
        const q3Display  = d.q3 >= 0 ? `+${d.q3.toFixed(2)}` : d.q3.toFixed(2);
        const minDisplay = d.min >= 0 ? `+${d.min}` : `${d.min}`;
        const maxDisplay = d.max >= 0 ? `+${d.max}` : `${d.max}`;
        const medColor   = d.median > 0 ? '#00FF9C' : d.median < 0 ? '#FF0101' : '#FFF301';

        g.append('path')
          .attr('d', arc())
          .attr('fill', 'transparent')
          .style('cursor', 'pointer')
          .on('mouseover', (event) => {
            tt.html(
              `<strong style="color:#E5E7E9;display:block;margin-bottom:4px">${t(`weekdays.${d.weekday}`)}</strong>` +
              `<span style="color:#94a3b8">${t('charts.gamesLabel')}: <strong style="color:#E5E7E9">${d.count}</strong></span><br/>` +
              `<span style="color:#94a3b8">${t('charts.netScore')}: <strong style="color:${medColor}">${medDisplay}</strong></span><br/>` +
              `<hr style="border:none;border-top:1px solid #2d333f;margin:5px 0"/>` +
              `<span style="color:#64748b">Q1 / Q3: <strong style="color:#E5E7E9">${q1Display} / ${q3Display}</strong></span><br/>` +
              `<span style="color:#64748b">Min / Max: <strong style="color:#E5E7E9">${minDisplay} / ${maxDisplay}</strong></span>`
            )
              .style('opacity', '1')
              .style('left', `${event.clientX + 14}px`)
              .style('top', `${event.clientY - 14}px`);
          })
          .on('mousemove', (event) => {
            tt.style('left', `${event.clientX + 14}px`)
              .style('top', `${event.clientY - 14}px`);
          })
          .on('mouseout', () => {
            tt.style('opacity', '0');
          });
      });

      // ── Entrance animation ───────────────────────────────────────────────────
      // Scale the data group from 0 → 1 (transform-origin at center)
      g.style('transform-origin', '0 0')
        .style('transform', 'scale(0)')
        .style('opacity', '0');

      // Use a short rAF to trigger transition after paint
      requestAnimationFrame(() => {
        g.style('transition', 'transform 0.55s cubic-bezier(0.34,1.2,0.64,1), opacity 0.4s ease')
          .style('transform', 'scale(1)')
          .style('opacity', '1');
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => {
      ro.disconnect();
      d3.select(container).selectAll('*').remove();
    };
  }, [data, t, maximized]);

  const isEmpty = !data || data.every(d => d.count === 0);

  const card = (
    <div
      className={`chart-card${maximized ? ' chart-card--max' : ''}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          flexShrink: 0,
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>
          {t('charts.radialTitle')}
        </h4>
        <button
          className="chart-max-btn"
          style={{ opacity: 1 }}
          onClick={() => setMaximized(m => !m)}
        >
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {isEmpty ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: '0.875rem',
          }}
        >
          {t('charts.radialNoData')}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      )}
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
