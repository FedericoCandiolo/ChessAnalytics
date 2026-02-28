import React, { useRef, useEffect, useState } from 'react';

import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { Maximize2, X } from 'lucide-react';

const CELL_SIZE = 11;
const GAP = 2;
const STEP = CELL_SIZE + GAP; // 13px per cell
const MARGIN_LEFT = 40;
const MARGIN_TOP = 22;
const YEAR_PADDING = 28; // vertical space between years (label + gap)

export default function CalendarChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
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
      .style('min-width', '160px');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    d3.select(container).selectAll('*').remove();

    if (!data || data.length === 0) return;

    const draw = () => {
      d3.select(container).selectAll('*').remove();

      // ---- Color scale ----
      const playedDays = data.filter(d => d.wins + d.losses + d.draws > 0);
      const maxAbs = Math.max(1, d3.max(playedDays, d => Math.abs(d.net)) || 1);
      const colorScale = d3.scaleLinear()
        .domain([-maxAbs, 0, maxAbs])
        .range(['#FF0101', '#FFF301', '#00FF9C'])
        .clamp(true);

      const cellFill = (d) =>
        (d.wins + d.losses + d.draws === 0) ? '#1e2533' : colorScale(d.net);

      // ---- Parse dates and group by year ----
      const byYear = d3.group(data, d => +d.date.slice(0, 4));
      const years = Array.from(byYear.keys()).sort((a, b) => a - b);

      // ---- Compute max weeks across years (for SVG width) ----
      // A year can have 52 or 53 week columns
      const MAX_WEEKS = 53;

      const svgWidth = MARGIN_LEFT + MAX_WEEKS * STEP;
      // Height: each year = MARGIN_TOP (month labels) + 7 rows + YEAR_PADDING
      const yearBlockH = MARGIN_TOP + 7 * STEP;
      const svgHeight = years.length * (yearBlockH + YEAR_PADDING);

      const svg = d3.select(container)
        .append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .style('display', 'block');

      const tt = tooltipRef.current;

      // ---- Day-of-week labels (shared, drawn relative to first year) ----
      const weekdayLabels = svg.append('g').attr('class', 'weekday-labels');

      for (let dow = 0; dow < 7; dow++) {
        // Only label Mon, Wed, Fri (indices 0, 2, 4) to avoid crowding
        if (dow % 2 !== 0) continue;
        weekdayLabels.append('text')
          .attr('x', MARGIN_LEFT - 4)
          .attr('y', MARGIN_TOP + dow * STEP + CELL_SIZE / 2 + 4)
          .attr('text-anchor', 'end')
          .style('font-size', '9px')
          .style('fill', '#64748b')
          .text(t(`weekdays.${dow}`));
      }

      // ---- Draw each year ----
      years.forEach((year, yearIdx) => {
        const yearDays = byYear.get(year);
        const yearOffsetY = yearIdx * (yearBlockH + YEAR_PADDING);

        const yearG = svg.append('g')
          .attr('class', `year-${year}`)
          .attr('transform', `translate(0, ${yearOffsetY})`);

        // Year label on the left
        yearG.append('text')
          .attr('x', MARGIN_LEFT - 4)
          .attr('y', MARGIN_TOP - 6)
          .attr('text-anchor', 'end')
          .style('font-size', '10px')
          .style('font-weight', '600')
          .style('fill', '#94a3b8')
          .text(year);

        // Build a map: date string → data
        const dayMap = new Map(yearDays.map(d => [d.date, d]));

        // Generate all days in this year from data range
        // (only the days present in data; fill in cells for entire year grid)
        const yearStart = new Date(year, 0, 1);

        // Generate full year day grid
        const allDays = d3.timeDays(yearStart, new Date(year + 1, 0, 1));

        // Group days into weeks (columns), using Monday-based weeks
        // weekOfYear: count of Mondays since start of year
        const weekGroups = d3.group(allDays, d => d3.timeMonday.count(d3.timeYear(d), d));
        const weekEntries = Array.from(weekGroups.entries()).sort((a, b) => a[0] - b[0]);

        // ---- Month labels ----
        // Detect when month changes across week columns to place labels
        const monthsDrawn = new Set();
        weekEntries.forEach(([weekIdx, days]) => {
          // Use the first day of the week to determine month label
          const firstDay = days[0];
          const month = firstDay.getMonth();
          if (!monthsDrawn.has(month)) {
            monthsDrawn.add(month);
            const x = MARGIN_LEFT + weekIdx * STEP;
            yearG.append('text')
              .attr('x', x)
              .attr('y', MARGIN_TOP - 6)
              .style('font-size', '9px')
              .style('fill', '#64748b')
              .text(d3.timeFormat('%b')(firstDay));
          }
        });

        // ---- Draw cells ----
        weekEntries.forEach(([weekIdx, days], wi) => {
          days.forEach(dayDate => {
            const dateStr = d3.timeFormat('%Y-%m-%d')(dayDate);
            const dow = (dayDate.getDay() + 6) % 7; // Mon=0, Sun=6
            const x = MARGIN_LEFT + weekIdx * STEP;
            const y = MARGIN_TOP + dow * STEP;

            const dayData = dayMap.get(dateStr) || {
              date: dateStr,
              wins: 0,
              losses: 0,
              draws: 0,
              net: 0,
            };

            const rect = yearG.append('rect')
              .attr('x', x)
              .attr('y', y)
              .attr('width', CELL_SIZE)
              .attr('height', CELL_SIZE)
              .attr('rx', 2)
              .attr('fill', cellFill(dayData))
              .attr('opacity', 0)
              .style('cursor', dayData.wins + dayData.losses + dayData.draws > 0 ? 'pointer' : 'default');

            // Staggered fade-in by week column
            rect.transition()
              .delay(wi * 8)
              .duration(250)
              .attr('opacity', 1);

            // Tooltip
            rect
              .on('mouseover', (event) => {
                const total = dayData.wins + dayData.losses + dayData.draws;
                if (total === 0) return;
                const netDisplay = dayData.net > 0 ? `+${dayData.net}` : `${dayData.net}`;
                const netColor = dayData.net > 0 ? '#00FF9C' : dayData.net < 0 ? '#FF0101' : '#FFF301';
                const formattedDate = d3.timeFormat('%B %d, %Y')(new Date(dateStr + 'T12:00:00'));
                tt.html(
                  `<strong style="color:#E5E7E9;display:block;margin-bottom:4px">${formattedDate}</strong>` +
                  `<span style="color:#94a3b8">${t('charts.gamesLabel')}: <strong style="color:#E5E7E9">${total}</strong></span><br/>` +
                  `<span style="color:#00FF9C">▮ ${t('results.wins')}: ${dayData.wins}</span><br/>` +
                  `<span style="color:#FFF301">▮ ${t('results.drawsLabel')}: ${dayData.draws}</span><br/>` +
                  `<span style="color:#FF0101">▮ ${t('results.losses')}: ${dayData.losses}</span><br/>` +
                  `<hr style="border:none;border-top:1px solid #2d333f;margin:5px 0"/>` +
                  `<span style="color:#94a3b8">${t('charts.netScore')}: <strong style="color:${netColor}">${netDisplay}</strong></span>`
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
        });
      });

      // ---- Color legend ----
      const legendY = svgHeight - 4;
      const legendG = svg.append('g').attr('transform', `translate(${MARGIN_LEFT}, ${legendY})`);
      const gradId = `cal-grad-${Math.random().toString(36).slice(2)}`;
      const defs = svg.append('defs');
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('x2', '100%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#FF0101');
      grad.append('stop').attr('offset', '50%').attr('stop-color', '#FFF301');
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#00FF9C');

      const barW = Math.min(200, MAX_WEEKS * STEP - 60);
      legendG.append('rect')
        .attr('width', barW)
        .attr('height', 6)
        .attr('rx', 3)
        .attr('fill', `url(#${gradId})`);
      legendG.append('text')
        .attr('x', 0).attr('y', 16)
        .style('font-size', '9px').style('fill', '#64748b')
        .text(t('results.losses'));
      legendG.append('text')
        .attr('x', barW / 2).attr('y', 16)
        .attr('text-anchor', 'middle')
        .style('font-size', '9px').style('fill', '#64748b')
        .text('=');
      legendG.append('text')
        .attr('x', barW).attr('y', 16)
        .attr('text-anchor', 'end')
        .style('font-size', '9px').style('fill', '#64748b')
        .text(t('results.wins'));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => {
      ro.disconnect();
      d3.select(container).selectAll('*').remove();
    };
  }, [data, t]);

  const isEmpty = !data || data.length === 0;

  return (
    <>
      {maximized && <div className="chart-max-overlay" onClick={() => setMaximized(false)} />}
      <div
        className={`chart-card${maximized ? ' chart-card--max' : ''}`}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
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
            {t('charts.calendarTitle')}
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
            {t('charts.calendarNoData')}
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'auto',
              minHeight: 0,
            }}
          />
        )}
      </div>
    </>
  );
}
