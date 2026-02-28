import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { FAMILY_COLORS } from '../constants';
import { Maximize2, X } from 'lucide-react';

export default function OpeningBubblesChart({ data }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const simRef = useRef(null);
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
      .style('max-width', '220px');
    return () => tooltipRef.current?.remove();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Stop any running simulation before redrawing
    const cleanup = () => {
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
      d3.select(container).selectAll('*').remove();
    };

    if (!data || data.length === 0) {
      cleanup();
      return;
    }

    const draw = () => {
      cleanup();

      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      const legendRowH = 28;
      const legendRows = 2;
      const legendH = legendRowH * legendRows + 16;
      const iW = width;
      const iH = Math.max(100, height - legendH);

      // SVG
      const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block');

      const defs = svg.append('defs');

      // Fill color scale: red → yellow → green
      const maxAbs = Math.max(1, d3.max(data, d => Math.abs(d.netScore)));
      const fillColor = d3.scaleLinear()
        .domain([-maxAbs, 0, maxAbs])
        .range(['#FF0101', '#FFF301', '#00FF9C'])
        .clamp(true);

      // Radius function
      const radius = d => Math.min(40, Math.max(8, Math.sqrt(d.total) * 3.5));

      // Compute cluster centers (ring layout)
      const families = [...new Set(data.map(d => d.family))];
      const angleOf = i => (i / families.length) * 2 * Math.PI - Math.PI / 2;
      const clusterCenters = {};
      families.forEach((fam, i) => {
        clusterCenters[fam] = {
          x: iW / 2 + Math.cos(angleOf(i)) * iW * 0.28,
          y: iH / 2 + Math.sin(angleOf(i)) * iH * 0.28,
        };
      });

      // Clone data as simulation nodes, starting at center
      const nodes = data.map(d => ({
        ...d,
        x: iW / 2 + (Math.random() - 0.5) * 40,
        y: iH / 2 + (Math.random() - 0.5) * 40,
      }));

      // Drawing group (clipped to bubble area)
      const clipId = `bubble-clip-${Math.random().toString(36).slice(2)}`;
      defs.append('clipPath').attr('id', clipId)
        .append('rect').attr('width', width).attr('height', iH);

      const bubbleG = svg.append('g').attr('clip-path', `url(#${clipId})`);

      // Draw circles
      const tt = tooltipRef.current;

      const circles = bubbleG.selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => radius(d))
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('fill', d => fillColor(d.netScore))
        .attr('stroke', d => FAMILY_COLORS[d.family] || '#94a3b8')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          const total = d.total || 1;
          const wp = Math.round((d.victoria / total) * 100);
          const dp = Math.round((d.tablas / total) * 100);
          const lp = Math.round((d.derrota / total) * 100);
          const familyLabel = t(`ecoFamilies.${d.family}`, d.family);
          const netDisplay = d.netScore > 0 ? `+${d.netScore}` : `${d.netScore}`;
          tt.html(
            `<strong style="color:#E5E7E9;display:block;margin-bottom:4px">${d.name}</strong>` +
            `<span style="color:#64748b;font-size:10px">${familyLabel}</span>` +
            `<hr style="border:none;border-top:1px solid #2d333f;margin:5px 0"/>` +
            `<span style="color:#00FF9C">▮ ${t('results.wins')}: ${d.victoria} (${wp}%)</span><br/>` +
            `<span style="color:#FFF301">▮ ${t('results.drawsLabel')}: ${d.tablas} (${dp}%)</span><br/>` +
            `<span style="color:#FF0101">▮ ${t('results.losses')}: ${d.derrota} (${lp}%)</span><br/>` +
            `<span style="color:#94a3b8">${t('charts.gamesLabel')}: <strong style="color:#E5E7E9">${d.total}</strong></span><br/>` +
            `<span style="color:#94a3b8">${t('charts.netScore')}: <strong style="color:${fillColor(d.netScore)}">${netDisplay}</strong></span>`
          )
            .style('opacity', '1')
            .style('left', `${event.clientX + 14}px`)
            .style('top', `${event.clientY - 14}px`);
        })
        .on('mousemove', event => {
          tt.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 14}px`);
        })
        .on('mouseout', () => tt.style('opacity', '0'));

      // Custom cluster force — must be a plain function, not an object
      function clusterForce(alpha) {
        nodes.forEach(d => {
          const center = clusterCenters[d.family];
          if (!center) return;
          d.vx += (center.x - d.x) * alpha * 0.3;
          d.vy += (center.y - d.y) * alpha * 0.3;
        });
      }

      const ticked = () => {
        circles.attr('cx', d => d.x).attr('cy', d => d.y);
      };

      const sim = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-20))
        .force('collide', d3.forceCollide(d => radius(d) + 2).iterations(3))
        .force('cluster', clusterForce)
        .on('tick', ticked);

      simRef.current = sim;

      // ---- Legend ----
      const legG = svg.append('g').attr('transform', `translate(0, ${iH + 8})`);

      // Row 1: family color circles + labels
      const famList = Object.keys(FAMILY_COLORS);
      const famItemW = Math.min(width / famList.length, 90);
      const row1StartX = (width - famList.length * famItemW) / 2;

      famList.forEach((fam, i) => {
        const lx = row1StartX + i * famItemW;
        legG.append('circle')
          .attr('cx', lx + 8)
          .attr('cy', 8)
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', FAMILY_COLORS[fam])
          .attr('stroke-width', 2);
        legG.append('text')
          .attr('x', lx + 18)
          .attr('y', 12)
          .style('font-size', '10px')
          .style('fill', '#94a3b8')
          .text(t(`ecoFamilies.${fam}`, fam));
      });

      // Row 2: net score gradient bar
      const barW = Math.min(260, width * 0.6);
      const barH = 8;
      const barX = (width - barW) / 2;
      const barY = legendRowH + 4;

      const gradId = `net-grad-${Math.random().toString(36).slice(2)}`;
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%').attr('x2', '100%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#FF0101');
      grad.append('stop').attr('offset', '50%').attr('stop-color', '#FFF301');
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#00FF9C');

      legG.append('rect')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', barW)
        .attr('height', barH)
        .attr('rx', 4)
        .attr('fill', `url(#${gradId})`);

      const labelStyle = (el) =>
        el.style('font-size', '9px').style('fill', '#64748b');

      labelStyle(legG.append('text')
        .attr('x', barX)
        .attr('y', barY + barH + 11)
        .attr('text-anchor', 'start'))
        .text(t('charts.losses', 'many losses'));

      labelStyle(legG.append('text')
        .attr('x', barX + barW / 2)
        .attr('y', barY + barH + 11)
        .attr('text-anchor', 'middle'))
        .text(t('charts.balanced', 'balanced'));

      labelStyle(legG.append('text')
        .attr('x', barX + barW)
        .attr('y', barY + barH + 11)
        .attr('text-anchor', 'end'))
        .text(t('charts.wins', 'many wins'));
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
      d3.select(container).selectAll('*').remove();
    };
  }, [data, t]);

  const emptyState = !data || data.length === 0;

  const card = (
    <div
      className={`chart-card${maximized ? ' chart-card--max' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
        <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#E5E7E9' }}>
          {t('charts.openingBubbles')}
        </h4>
        <button
          className="chart-max-btn"
          style={{ opacity: 1 }}
          onClick={() => setMaximized(m => !m)}
        >
          {maximized ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Body */}
      {emptyState ? (
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
          {t('charts.openingBubblesNoData')}
        </div>
      ) : (
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
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
