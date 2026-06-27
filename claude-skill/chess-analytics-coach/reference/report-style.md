# ChessAnalytics Report Style Guide

How to compose a **chess performance report** so it always looks like ChessAnalytics.
You design the layout freely (guided improvisation), but the **brand rules below are
mandatory for any chess-related report**. Deviate only if the user *explicitly* asks for a
different look **and** you've confirmed it with them first.

You may render the report by composing HTML yourself (preferred — richer, tailored to the
conversation) or by running `scripts/build_report.py`. Either way, the brand rules apply.

**Output format: produce HTML by default. Only generate a PDF if the user explicitly asks
for one** (e.g. "give me a PDF", "I need it as PDF"). The HTML report is the primary
deliverable.

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

## 6. Rendering (HTML by default)

The font and logo only appear if you **embed the asset files** — you cannot hand-type the
42 KB base64. **The logo is an `<img>` with a data-URI `src`, never plain text.** The
reliable way: write your HTML with the tokens `__BRAND_CSS__` and `__CA_LOGO__`, then
replace them with the asset contents in Python (token-replace avoids f-string brace issues):

```python
import os
A = os.path.join(os.path.dirname(__file__), "assets")   # or the skill's assets/ path

TEMPLATE = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
__BRAND_CSS__
@page { size:A4; margin:15mm; }
body { font-family:'Inter',system-ui,sans-serif; margin:0; color:#1a1a1a; }
.report-header { background:linear-gradient(135deg,#0a0b0e,#10212c 55%,#013a52);
  color:#fff; padding:34px 44px; }
.ca-logo { height:32px; width:auto; display:block; margin-bottom:12px; }
.content { max-width:960px; margin:0 auto; padding:36px 44px; }
@media print {
  .report-header { margin:-15mm -15mm 16mm; }          /* full-bleed exception */
  .content { max-width:none; padding:8px 0 0; }
  .card,.insight,.rec,.kpi,.day-box,tr,table,.section { break-inside:avoid; }
}
</style></head>
<body>
  <div class="report-header">
    <img class="ca-logo" src="__CA_LOGO__" alt="ChessAnalytics">
    <!-- brand line, player name, KPI strip -->
  </div>
  <div class="content"><!-- your sections --></div>
</body></html>"""

html = (TEMPLATE
        .replace("__BRAND_CSS__", open(os.path.join(A, "brand.css"), encoding="utf-8").read())
        .replace("__CA_LOGO__",   open(os.path.join(A, "logo-dark.txt"), encoding="utf-8").read().strip()))

open("report.html", "w", encoding="utf-8").write(html)   # ← the default deliverable

# Only if the user explicitly asked for a PDF:
# from weasyprint import HTML
# HTML(string=html).write_pdf("report.pdf")
```

`__CA_LOGO__` embeds the wordmark image; `__BRAND_CSS__` embeds Inter. Always include the
logo `<img>` in the header. If a PDF is requested and weasyprint isn't available, deliver
the HTML and tell the user to open it and **Print → Save as PDF**.

## 7. Quick alternative

`scripts/build_report.py --input report.json --format both` renders a brand-compliant
report from a content JSON (it embeds the same assets and print rules). Use it when you
want a fast, guaranteed-consistent output instead of composing HTML by hand.
