import { jsPDF } from 'jspdf';

// ── Palette (matches the app's dark theme) ────────────────────────────────
const BG      = [10, 11, 14];      // #0a0b0e
const BG_CARD = [14, 17, 23];      // #0e1117
const TEXT1   = [226, 232, 240];   // #E2E8F0
const TEXT2   = [100, 116, 139];   // #64748b
const ACCENT  = [0, 255, 156];     // #00FF9C
const BORDER  = [45, 51, 63];      // #2d333f

// ── SVG → PNG data URL ────────────────────────────────────────────────────
async function svgToDataUrl(svgEl) {
  const w = +svgEl.getAttribute('width');
  const h = +svgEl.getAttribute('height');
  if (!w || !h) return null;

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = '* { font-family: Arial, Helvetica, sans-serif !important; }';
  clone.insertBefore(style, clone.firstChild);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const b64 = btoa(unescape(encodeURIComponent(svgStr)));
  const src  = `data:image/svg+xml;base64,${b64}`;

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

// ── Main export function ──────────────────────────────────────────────────
export async function generatePDF({ filters, stats, t, setProgress }) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const A4W = 210, A4H = 297, M = 10;
  const CW  = A4W - 2 * M;

  setProgress && setProgress(5);

  const fillPage = () => {
    pdf.setFillColor(...BG);
    pdf.rect(0, 0, A4W, A4H, 'F');
  };

  const hline = (y) => {
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.25);
    pdf.line(M, y, A4W - M, y);
  };

  // ── PAGE 1: Compact cover + filters + summary ─────────────────────────
  fillPage();

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...ACCENT);
  pdf.text('ChessAnalytics', M, 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...TEXT2);
  pdf.text(new Date().toLocaleDateString(), M, 24);
  pdf.text(t('pdf.disclaimer', 'Data from Chess.com public API · Not affiliated with Chess.com'), M, 29);

  hline(33);

  let y = 40;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...TEXT1);
  pdf.text(t('filters.title', 'Filters'), M, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  const LW = 38;

  const writeRow = (label, value) => {
    if (!value && value !== 0) return;
    pdf.setTextColor(...TEXT2);
    pdf.text(`${label}:`, M, y);
    pdf.setTextColor(...TEXT1);
    pdf.text(String(value), M + LW, y, { maxWidth: CW - LW });
    y += 5;
  };

  const hasFilters =
    filters.rules.length || filters.timeClasses.length || filters.rated.length ||
    filters.results.length || filters.colors.length || filters.years.length ||
    filters.months.length || (filters.family && filters.family !== 'all') ||
    (filters.opening && filters.opening !== 'all') ||
    filters.dateFrom || filters.dateTo;

  if (!hasFilters) {
    pdf.setTextColor(...TEXT2);
    pdf.text(t('pdf.noFilters', 'No filters applied — all games shown'), M, y);
    y += 5;
  } else {
    if (filters.rules.length)       writeRow(t('filters.rules', 'Rules'),         filters.rules.join(', '));
    if (filters.timeClasses.length) writeRow(t('filters.timeClass', 'Time'),      filters.timeClasses.map(tc => t(`timeClasses.${tc}`, tc)).join(', '));
    if (filters.rated.length)       writeRow(t('filters.evaluation', 'Eval'),     filters.rated.map(r => r === 1 ? t('filters.rated') : t('filters.unrated')).join(', '));
    if (filters.results.length)     writeRow(t('filters.result', 'Results'),      filters.results.map(r => t(`results.${r}`, r)).join(', '));
    if (filters.colors.length)      writeRow(t('filters.pieces', 'Color'),        filters.colors.map(c => t(`colorLabels.${c}`, c)).join(', '));
    if (filters.family && filters.family !== 'all') writeRow(t('filters.openingFamily', 'Family'), filters.family);
    if (filters.opening && filters.opening !== 'all') writeRow(t('filters.opening', 'Opening'),   filters.opening);
    if (filters.years.length)       writeRow(t('filters.year', 'Years'),          filters.years.join(', '));
    if (filters.months.length)      writeRow(t('filters.month', 'Months'),        filters.months.join(', '));
    if (filters.dateFrom || filters.dateTo) writeRow(t('filters.dateRange', 'Range'), `${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`);
  }

  if (stats) {
    y += 2;
    hline(y); y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...TEXT1);
    pdf.text(t('pdf.summary', 'Summary'), M, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    const total = (stats.pie || []).reduce((s, d) => s + d.value, 0);
    writeRow(t('header.games', 'Total games'), total);
    writeRow(t('charts.winRate', 'Win rate'), `${stats.winRate ?? 0}%`);
  }

  setProgress && setProgress(15);

  // ── PAGE 2: All charts in 4-row × 2-col grid ─────────────────────────
  // All slides are always mounted (position:absolute), so SVGs are already drawn.
  const allCards = Array.from(document.querySelectorAll('.chart-slide .chart-card'));

  // Capture all SVGs
  const captures = [];
  for (let i = 0; i < allCards.length; i++) {
    setProgress && setProgress(15 + Math.round((i / allCards.length) * 75));
    const card  = allCards[i];
    const svg   = card.querySelector('svg');
    const title = card.querySelector('h4')?.textContent?.trim() || '';
    if (!svg) continue;
    const cap = await svgToDataUrl(svg);
    if (cap) captures.push({ ...cap, title });
  }

  if (captures.length === 0) {
    setProgress && setProgress(100);
    pdf.save('chess-analytics-report.pdf');
    return;
  }

  // Grid layout: 2 cols × 4 rows on one A4 page
  const COLS   = 2;
  const GAP    = 3;
  const TITH   = 6;    // title row height
  const colW   = (CW - (COLS - 1) * GAP) / COLS;
  // Distribute rows evenly — if >8 charts, they'll overflow but still render
  const nRows  = Math.ceil(captures.length / COLS);
  const rowH   = (A4H - 2 * M - (nRows - 1) * GAP) / nRows;
  const imgH   = rowH - TITH - 1;

  pdf.addPage();
  fillPage();

  captures.forEach((cap, idx) => {
    const row = Math.floor(idx / COLS);
    const col = idx % COLS;
    const cx  = M + col * (colW + GAP);
    const cy  = M + row * (rowH + GAP);

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...TEXT1);
    pdf.text(cap.title, cx, cy + 4.5, { maxWidth: colW });

    // Chart image (preserve aspect ratio within cell)
    const aspect = cap.h / cap.w;
    const drawH  = Math.min(imgH, colW * aspect);
    const yImg   = cy + TITH;

    pdf.setFillColor(...BG_CARD);
    pdf.rect(cx, yImg, colW, drawH, 'F');
    pdf.addImage(cap.dataUrl, 'PNG', cx, yImg, colW, drawH);
  });

  setProgress && setProgress(100);
  pdf.save('chess-analytics-report.pdf');
}
