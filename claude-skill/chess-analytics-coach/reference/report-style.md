# ChessAnalytics Report Style Guide

How to compose a **chess performance report** so it always looks like ChessAnalytics.
You design the layout freely (guided improvisation), but the **brand rules below are
mandatory for any chess-related report**. Deviate only if the user *explicitly* asks for a
different look **and** you've confirmed it with them first.

You may render the report by composing HTML yourself (preferred — richer, tailored to the
conversation) or by running `scripts/build_report.py`. Either way, the brand rules apply.

## 1. Bundled brand assets (always use them)

The skill ships the real ChessAnalytics font and logo in `assets/`. Embed them so the
output is self-contained (works as a standalone HTML file AND in the PDF):

- **Font** — `assets/brand.css` contains the **Inter** font (weights 400/600/700, embedded
  as base64) plus the brand color tokens as CSS variables. Read this file and paste its
  full contents inside your `<style>` block. Then use `font-family:'Inter',system-ui,
  sans-serif` on `body`.
- **Logo** — `assets/logo-dark.txt` is a `data:image/png;base64,…` URI of the
  ChessAnalytics wordmark for **dark** backgrounds (use it in the dark header).
  `assets/logo-light.txt` is the variant for light backgrounds. Drop it straight into an
  `<img src="…">`, e.g. height ~34px in the header.

Never link to Google Fonts or remote images — the sandbox has no network; embedding is the
only thing that renders.

## 2. Color tokens

`brand.css` defines these (use the CSS vars, or the hex directly):

| Purpose | Var | Hex |
|---|---|---|
| Header background | gradient of `--ca-hdr1/2/3` | `#0a0b0e → #10212c → #013a52` |
| Accent (brand) | `--ca-accent` | `#01B6FF` |
| Win (on dark header) | `--ca-win-neon` | `#00FF9C` |
| Win (on light body) | `--ca-green` | `#10a572` |
| Draw / warning | `--ca-amber` | `#d98c00` |
| Loss | `--ca-red` | `#e0392f` |
| Black-pieces accent | `--ca-purple` | `#5b46c0` |
| Grays | `--ca-g900…g50` | text → backgrounds |

Semantic rules: **win/positive = green, draw/neutral = amber, loss/negative = red.**
Win-rate bar/text color by value: ≥50 green, ≥45 blue (`--ca-blue`), ≥40 amber, else red.
NetScore badge: >0 green, <0 red, 0 amber.

## 3. Typography

Inter throughout. Player name / big numbers: 700. Section headings & labels: 600,
uppercase, letter-spacing ~.06em, in `--ca-g500`. Body text: 400, ~12–14px, line-height
~1.6. KPI values: 700, ~28–30px.

## 4. Layout (recommended — adapt to the data you have)

1. **Header (dark, full-bleed)** — `--ca-hdr` gradient. Top: the ChessAnalytics logo +
   a brand line ("Chess.com · Análisis de rendimiento") and the player name. A KPI strip:
   main-time-class ELO, total games, win rate, main time control.
2. **ELO by time control** — a card per time class (bullet/blitz/rapid/daily) with current
   + peak; mark the main one.
3. **Performance by color** + **accuracy distribution** (side by side).
4. **Weekday performance** (medianNetScore) and **monthly trend** (win rate).
5. **Top openings** — table: opening + ECO, win %, games, netScore badge.
6. **Strengths**, **Weaknesses** (colored cards), **Recommendations** (numbered).
7. **Footer** — brand line + "Fuente: Chess.com" + games analyzed + generated date.

Respond in the user's language (Spanish report → Spanish labels). Only render sections you
have data for.

## 5. Print / PDF rules (MANDATORY)

These fix the page-break and margin problems. The **header is the only full-bleed element;
enforce margins everywhere else.**

```css
@page { size: A4; margin: 15mm; }            /* top+bottom+sides on EVERY page */
body  { margin: 0; font-family:'Inter',system-ui,sans-serif; }

/* Full-bleed header = the documented exception. Pull it out into the page margins.
   The negative margin MUST equal the @page margin (here 15mm). */
.report-header { margin: -15mm -15mm 14mm -15mm; padding: 30px 15mm; }

/* Never split a visual block across a page. */
@media print {
  .kpi, .card, .insight, .rec, .day-box, .elo-card, tr,
  table, .chart-block, .section { break-inside: avoid; }
  h2, .section-header { break-after: avoid; }
}
```

Notes:
- The uniform `@page` margin guarantees content never touches the page edge and never gets
  cut at the top/bottom of continuation pages.
- Keep each chart/section in a wrapper with `break-inside:avoid` so a chart is never split.
  If a block is genuinely taller than a page, let it flow — but that should be rare.
- If the full-bleed header doesn't bleed in your renderer, it degrades to a header that
  simply starts at the top margin — still fine.

## 6. Rendering

Compose one HTML string with `brand.css` inlined and the logo embedded, then:

```python
from weasyprint import HTML
html = "...your report..."
open("report.html", "w", encoding="utf-8").write(html)   # self-contained HTML deliverable
HTML(string=html).write_pdf("report.pdf")                 # PDF
```

weasyprint renders the embedded Inter + logo and honors the print rules above. Give the
user the HTML and/or PDF as they requested. If weasyprint isn't available, deliver the HTML
and tell them to open it and **Print → Save as PDF**.

## 7. Quick alternative

`scripts/build_report.py --input report.json --format both` renders a brand-compliant
report from a content JSON (it embeds the same assets and print rules). Use it when you
want a fast, guaranteed-consistent output instead of composing HTML by hand.
