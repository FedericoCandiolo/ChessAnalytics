import { jsPDF } from 'jspdf';
import i18n from '../i18n/i18n';

// ── Palette ───────────────────────────────────────────────────────────────────
const BG      = [10, 11, 14];
const BG_CARD = [14, 17, 23];
const TEXT1   = [226, 232, 240];
const TEXT2   = [100, 116, 139];
const ACCENT  = [0, 255, 156];
const BORDER  = [45, 51, 63];

// ── SVG capture ───────────────────────────────────────────────────────────────

// Returns the main chart SVG (largest area), ignoring tiny icon SVGs.
function getChartSvg(card) {
  const svgs = Array.from(card.querySelectorAll('svg'));
  if (!svgs.length) return null;
  return svgs.reduce((best, el) => {
    const r  = el.getBoundingClientRect();
    const br = best ? best.getBoundingClientRect() : { width: 0, height: 0 };
    return r.width * r.height > br.width * br.height ? el : best;
  }, null);
}

async function svgToDataUrl(svgEl) {
  if (!svgEl) return null;
  const rect = svgEl.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (!w || !h) return null;

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns',       'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width',  w);
  clone.setAttribute('height', h);

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = '* { font-family: Arial, Helvetica, sans-serif !important; }';
  clone.insertBefore(style, clone.firstChild);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const b64    = btoa(unescape(encodeURIComponent(svgStr)));
  const src    = `data:image/svg+xml;base64,${b64}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale  = 2;
      const canvas = document.createElement('canvas');
      canvas.width  = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0e1117';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), w, h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function captureChart(type) {
  const card = document.querySelector(`[data-chart="${type}"]`);
  if (!card) return null;
  const svg   = getChartSvg(card);
  if (!svg)   return null;
  const title = card.querySelector('h4')?.textContent?.trim() || '';
  const cap   = await svgToDataUrl(svg);
  return cap ? { ...cap, title } : null;
}

// ── Result colors — exact match with RESULT_COLORS in constants.js ────────────
const WIN_COLOR  = [0, 255, 156];    // #00FF9C
const DRAW_COLOR = [255, 243, 1];    // #FFF301
const LOSS_COLOR = [255, 1, 1];      // #FF0101

// ── Openings chart drawn natively (Pareto + Others, no SVG capture) ───────────
function drawOpeningsNative(pdf, rawData, cx, cy, cw, ch, t) {
  if (!rawData || !rawData.length) return;

  // Compute Pareto openings + aggregate Others
  const totalGames = rawData.reduce((s, d) => s + d.total, 0);
  const N = rawData.length;
  let cumGames = 0;
  const data = [];
  let othersV = 0, othersT = 0, othersD = 0;

  rawData.forEach((d, i) => {
    cumGames += d.total;
    const inPareto = ((i + 1) / N) + (cumGames / (totalGames || 1)) <= 1.0;
    if (inPareto) {
      data.push(d);
    } else {
      othersV += d.victoria;
      othersT += d.tablas;
      othersD += d.derrota;
    }
  });
  const othersTotal = othersV + othersT + othersD;
  if (othersTotal > 0) {
    data.push({ name: t('charts.others'), victoria: othersV, tablas: othersT, derrota: othersD, total: othersTotal });
  }

  const TITLE_H  = 4.5;
  const LEGEND_H = 5;
  const ML = 33;   // left margin for opening names
  const MR = 9;    // right margin for count labels

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.5);
  pdf.setTextColor(...TEXT1);
  pdf.text(t('charts.openingSuccess'), cx, cy + 3.2, { maxWidth: cw });

  // Background
  pdf.setFillColor(...BG_CARD);
  pdf.rect(cx, cy + TITLE_H, cw, ch - TITLE_H, 'F');

  const chartH   = ch - TITLE_H - LEGEND_H;
  const barAreaW = cw - ML - MR;
  const n        = data.length;
  const barH     = Math.min(6, (chartH - 2) / n);
  const padding  = (chartH - n * barH) / (n + 1);
  const maxVal   = Math.max(...data.map(d => d.total));
  const scaleX   = (v) => (v / (maxVal || 1)) * barAreaW;

  data.forEach((d, i) => {
    const barY = cy + TITLE_H + padding + i * (barH + padding);
    const barX = cx + ML;

    // Opening name (right-aligned, truncated)
    const name = d.name.length > 21 ? d.name.slice(0, 20) + '…' : d.name;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4.2);
    pdf.setTextColor(...TEXT2);
    pdf.text(name, cx + ML - 1, barY + barH * 0.72, { align: 'right', maxWidth: ML - 1 });

    // Stacked bars
    const winW  = scaleX(d.victoria);
    const drawW = scaleX(d.tablas);
    const lossW = scaleX(d.derrota);

    if (winW  > 0.1) { pdf.setFillColor(...WIN_COLOR);  pdf.rect(barX,                  barY, winW,  barH, 'F'); }
    if (drawW > 0.1) { pdf.setFillColor(...DRAW_COLOR); pdf.rect(barX + winW,            barY, drawW, barH, 'F'); }
    if (lossW > 0.1) { pdf.setFillColor(...LOSS_COLOR); pdf.rect(barX + winW + drawW,    barY, lossW, barH, 'F'); }

    // Total count label
    pdf.setFontSize(3.8);
    pdf.setTextColor(...TEXT2);
    pdf.text(String(d.total), barX + winW + drawW + lossW + 1, barY + barH * 0.72);
  });

  // Legend
  const legY = cy + ch - 1.5;
  [
    { color: WIN_COLOR,  label: t('results.wins') },
    { color: DRAW_COLOR, label: t('results.drawsLabel') },
    { color: LOSS_COLOR, label: t('results.losses') },
  ].forEach((item, i) => {
    const lx = cx + ML + i * 22;
    pdf.setFillColor(...item.color);
    pdf.rect(lx, legY - 2.5, 4, 2.5, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4.2);
    pdf.setTextColor(...TEXT2);
    pdf.text(item.label, lx + 5, legY);
  });
}

// ── Draw a chart into a PDF cell, preserving aspect ratio (letterbox) ─────────
function drawChart(pdf, cap, cx, cy, cw, ch) {
  if (!cap) return;

  const TITLE_H = 4.5;
  const yImg    = cy + TITLE_H;
  const imgH    = ch - TITLE_H;

  // Title
  if (cap.title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(5.5);
    pdf.setTextColor(...TEXT1);
    pdf.text(cap.title, cx, cy + 3.2, { maxWidth: cw });
  }

  // Background cell
  pdf.setFillColor(...BG_CARD);
  pdf.rect(cx, yImg, cw, imgH, 'F');

  // Fit image maintaining aspect ratio (letterbox / pillarbox)
  const aspect = cap.h / cap.w;
  let drawW = cw;
  let drawH = cw * aspect;
  if (drawH > imgH) {
    drawH = imgH;
    drawW = imgH / aspect;
  }
  const xOff = (cw - drawW) / 2;
  const yOff = (imgH - drawH) / 2;

  pdf.addImage(cap.dataUrl, 'PNG', cx + xOff, yImg + yOff, drawW, drawH);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generatePDF({ filters, stats, t, setProgress }) {
  const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const A4W  = 210;
  const A4H  = 297;
  const M    = 8;
  const CW   = A4W - 2 * M;   // 194mm
  const GAP  = 3;
  const CGAP = 3;
  const lang   = i18n.language || 'en';
  const locale = lang === 'es' ? 'es-AR' : 'en-US';

  setProgress?.(5);

  // Capture all charts in parallel up front
  const [elo, pie, calendar, accuracy, color, monthly, bubbles] =
    await Promise.all([
      captureChart('elo'),
      captureChart('pie'),
      captureChart('calendar'),
      captureChart('accuracy'),
      captureChart('color'),
      captureChart('monthly'),
      captureChart('bubbles'),
    ]);

  setProgress?.(55);

  const fillPage = () => {
    pdf.setFillColor(...BG);
    pdf.rect(0, 0, A4W, A4H, 'F');
  };
  const hline = (y) => {
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(M, y, A4W - M, y);
  };

  // ── PAGE 1: Introduction + compact charts ─────────────────────────────────
  fillPage();

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...ACCENT);
  pdf.text('ChessAnalytics', M, 17);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...TEXT2);
  const dateStr = new Date().toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  pdf.text(dateStr, M, 23);
  pdf.text(t('pdf.disclaimer'), M, 28);
  hline(31);

  let y = 38;

  // Filters section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...TEXT1);
  pdf.text(t('filters.title'), M, y);
  y += 5.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  const LW = 38;

  const writeRow = (label, value) => {
    if (!value && value !== 0) return;
    pdf.setTextColor(...TEXT2);
    pdf.text(`${label}:`, M, y);
    pdf.setTextColor(...TEXT1);
    pdf.text(String(value), M + LW, y, { maxWidth: CW - LW });
    y += 4.8;
  };

  const hasFilters =
    filters.rules?.length     || filters.timeClasses?.length ||
    filters.rated?.length     || filters.results?.length     ||
    filters.colors?.length    || filters.years?.length       ||
    filters.months?.length    ||
    (filters.family  && filters.family  !== 'all') ||
    (filters.opening && filters.opening !== 'all') ||
    filters.dateFrom || filters.dateTo;

  if (!hasFilters) {
    pdf.setTextColor(...TEXT2);
    pdf.text(t('pdf.noFilters'), M, y);
    y += 4.8;
  } else {
    if (filters.rules?.length)
      writeRow(t('filters.rules'),        filters.rules.join(', '));
    if (filters.timeClasses?.length)
      writeRow(t('filters.timeClass'),    filters.timeClasses.map(tc => t(`timeClasses.${tc}`, tc)).join(', '));
    if (filters.rated?.length)
      writeRow(t('filters.evaluation'),   filters.rated.map(r => r === 1 ? t('filters.rated') : t('filters.unrated')).join(', '));
    if (filters.results?.length)
      writeRow(t('filters.result'),       filters.results.map(r => t(`results.${r}`, r)).join(', '));
    if (filters.colors?.length)
      writeRow(t('filters.pieces'),       filters.colors.map(c => t(`colorLabels.${c}`, c)).join(', '));
    if (filters.family && filters.family !== 'all')
      writeRow(t('filters.openingFamily'), filters.family);
    if (filters.opening && filters.opening !== 'all')
      writeRow(t('filters.opening'),      filters.opening);
    if (filters.years?.length)
      writeRow(t('filters.year'),         filters.years.join(', '));
    if (filters.months?.length)
      writeRow(t('filters.month'),        filters.months.join(', '));
    if (filters.dateFrom || filters.dateTo)
      writeRow(t('filters.dateRange'),    `${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`);
  }

  // Summary section
  y += 2;
  hline(y); y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...TEXT1);
  pdf.text(t('pdf.summary'), M, y);
  y += 5.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  if (stats) {
    const pie_data = stats.pie || [];
    const total    = pie_data.reduce((s, d) => s + d.value, 0);
    const wins     = pie_data.find(p => p.name === 'victoria')?.value ?? 0;
    const draws    = pie_data.find(p => p.name === 'tablas')?.value   ?? 0;
    const losses   = pie_data.find(p => p.name === 'derrota')?.value  ?? 0;
    const pct      = (n) => total ? `${Math.round(n / total * 100)}%` : '0%';

    writeRow(t('header.games'),       total);
    writeRow(t('results.wins'),       `${wins} (${pct(wins)})`);
    writeRow(t('results.drawsLabel'), `${draws} (${pct(draws)})`);
    writeRow(t('results.losses'),     `${losses} (${pct(losses)})`);
    if (stats.winRate != null)
      writeRow(t('charts.winRate'),   `${stats.winRate}%`);
  }

  // ── Charts on page 1 (use remaining vertical space) ──────────────────────
  //
  //  Row A (3-col equal): Pie | Accuracy | Color
  //  Row B (full width):  Monthly
  //
  const chartTop = y + 6;
  const chartBottom = A4H - M;           // 289mm
  const available = chartBottom - chartTop;

  if (available >= 60) {
    const cw3    = Math.round((CW - 2 * CGAP) / 3);
    const cx2    = M + cw3 + CGAP;
    const cx3    = cx2 + cw3 + CGAP;
    const rowAH  = Math.round(available * 0.44);
    const rowBH  = available - rowAH - GAP;

    drawChart(pdf, pie,      M,   chartTop,          cw3, rowAH);
    drawChart(pdf, accuracy, cx2, chartTop,          cw3, rowAH);
    drawChart(pdf, color,    cx3, chartTop,          cw3, rowAH);
    drawChart(pdf, monthly,  M,   chartTop + rowAH + GAP, CW, rowBH);
  }

  setProgress?.(75);

  // ── PAGE 2: Four large charts, each full width ────────────────────────────
  //
  //  ELO      — needs horizontal spread for the timeline
  //  Openings — benefits from width for all the bars
  //  Calendar — inherently very wide
  //  Bubbles  — force layout, takes the most remaining space
  //
  const hasCharts = [elo, calendar, bubbles].some(Boolean) || (stats?.stackedOpenings?.length > 0);
  if (!hasCharts) {
    setProgress?.(100);
    pdf.save('chess-analytics-report.pdf');
    return;
  }

  pdf.addPage();
  fillPage();

  const CH   = A4H - 2 * M;   // 281mm
  const R1H  = 55;
  const R2H  = 70;
  const R3H  = 55;
  const R4H  = CH - R1H - GAP - R2H - GAP - R3H - GAP;  // ≈ 93mm for Bubbles

  drawChart(pdf, elo,     M, M,                                         CW, R1H);
  drawOpeningsNative(pdf, stats?.stackedOpenings, M, M + R1H + GAP,     CW, R2H, t);
  drawChart(pdf, calendar, M, M + R1H + GAP + R2H + GAP,               CW, R3H);
  drawChart(pdf, bubbles,  M, M + R1H + GAP + R2H + GAP + R3H + GAP,  CW, R4H);

  setProgress?.(100);
  pdf.save('chess-analytics-report.pdf');
}
