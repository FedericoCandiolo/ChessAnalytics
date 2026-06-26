#!/usr/bin/env python3
"""Render a coaching report in the ChessAnalytics visual style — HTML and/or PDF.

Claude assembles the report content (the analysis it produced in the conversation +
the key stats) into a JSON file, then runs ONE of:

    python scripts/build_report.py --input report.json --format html   # default
    python scripts/build_report.py --input report.json --format pdf
    python scripts/build_report.py --input report.json --format both

HTML is a single self-contained file (inline CSS, no deps) that opens in any browser.
PDF generation tries, in order: weasyprint (renders the exact HTML → brand-perfect),
then reportlab (clean branded fallback). If neither library is available the script
writes the HTML and tells you to use the browser's Print → Save as PDF.

Input JSON schema (all sections optional except player + at least one of the lists):

    {
      "player": "fede",
      "lang": "es" | "en",                 # default "en"
      "dateRange": {"from": "...", "to": "..."},
      "headline": "2-3 sentence summary",
      "summary": {
        "totalGames": 412, "winRate": 56, "wins": 230, "losses": 150, "draws": 32,
        "mainTimeClass": "blitz",
        "currentEloByTimeClass": {"blitz": 2890},
        "peakEloByTimeClass":    {"blitz": 2945}
      },
      "strengths":       ["...", "..."],
      "weaknesses":      ["...", "..."],
      "recommendations": ["...", "..."],
      "topOpenings":     [{"name": "...", "games": 54, "winRate": 56, "netScore": 12}],
      "colorPerformance":[{"color": "white", "winRate": 60, "total": 218}],
      "accuracyDistribution": [{"bucket": "90+", "count": 33}],
      "monthlyTrend":    [{"month": "2024-09", "winRate": 55, "games": 60}]
    }
"""

import argparse
import html
import json
from datetime import datetime, timezone

# ChessAnalytics design tokens (from the app's index.css)
C = {
    "bg": "#0a0b0e", "card": "#161a23", "item": "#2d333f", "border": "#2d333f",
    "text": "#E5E7E9", "sub": "#94a3b8",
    "win": "#00FF9C", "draw": "#FFF301", "loss": "#FF0101", "accent": "#01B6FF",
}
TC_COLOR = {"rapid": "#10b981", "blitz": "#f59e0b", "bullet": "#ef4444", "daily": "#a855f7"}

L = {
    "en": {
        "title": "Performance Report", "games": "Games", "winRate": "Win Rate",
        "elo": "ELO", "peak": "Peak", "strengths": "Strengths", "weaknesses": "Weaknesses",
        "recs": "Recommendations", "openings": "Top Openings", "accuracy": "Accuracy Distribution",
        "color": "Performance by Color", "monthly": "Monthly Trend", "generated": "Generated",
        "white": "White", "black": "Black", "net": "Net", "op": "Opening",
        "disclaimer": "Built from Chess.com public data · Not affiliated with Chess.com",
    },
    "es": {
        "title": "Informe de Rendimiento", "games": "Partidas", "winRate": "Victorias",
        "elo": "ELO", "peak": "Máx", "strengths": "Fortalezas", "weaknesses": "Debilidades",
        "recs": "Recomendaciones", "openings": "Mejores Aperturas", "accuracy": "Distribución de Precisión",
        "color": "Rendimiento por Color", "monthly": "Tendencia Mensual", "generated": "Generado",
        "white": "Blancas", "black": "Negras", "net": "Neto", "op": "Apertura",
        "disclaimer": "Generado con datos públicos de Chess.com · Sin afiliación con Chess.com",
    },
}


def esc(s):
    return html.escape(str(s))


def kpi(label, value, color=None):
    col = color or C["text"]
    return (f'<div class="kpi"><div class="kpi-label">{esc(label)}</div>'
            f'<div class="kpi-value" style="color:{col}">{esc(value)}</div></div>')


def bar(label, pct, color, right=""):
    pct = max(0, min(100, pct))
    return (f'<div class="bar-row"><span class="bar-label">{esc(label)}</span>'
            f'<span class="bar-track"><span class="bar-fill" style="width:{pct:.0f}%;'
            f'background:{color}"></span></span>'
            f'<span class="bar-val">{esc(right)}</span></div>')


def ul(items, kind):
    lis = "".join(f"<li>{esc(x)}</li>" for x in items)
    return f'<ul class="list {kind}">{lis}</ul>'


def build_html(d):
    t = L.get(d.get("lang", "en"), L["en"])
    player = esc(d.get("player", "—"))
    dr = d.get("dateRange") or {}
    rng = f'{dr.get("from","")} → {dr.get("to","")}'.strip(" →")
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    parts = []

    # Header + KPIs
    s = d.get("summary") or {}
    main_tc = s.get("mainTimeClass")
    cur = (s.get("currentEloByTimeClass") or {}).get(main_tc) if main_tc else None
    peak = (s.get("peakEloByTimeClass") or {}).get(main_tc) if main_tc else None
    kpis = []
    if "totalGames" in s:
        kpis.append(kpi(t["games"], s["totalGames"]))
    if "winRate" in s:
        kpis.append(kpi(t["winRate"], f'{s["winRate"]}%', C["win"]))
    if cur is not None:
        tc_col = TC_COLOR.get(main_tc, C["accent"])
        kpis.append(kpi(f'{t["elo"]} ({main_tc})', cur, tc_col))
    if peak is not None:
        kpis.append(kpi(f'{t["peak"]} {t["elo"]}', peak, TC_COLOR.get(main_tc, C["accent"])))
    if "wins" in s and "losses" in s and "draws" in s:
        wdl = f'{s["wins"]}–{s["draws"]}–{s["losses"]}'
        kpis.append(kpi("W–D–L", wdl))

    parts.append(f'''
      <header class="hero">
        <div>
          <div class="brand">ChessAnalytics</div>
          <h1>{esc(player)}</h1>
          <div class="meta">{esc(t["title"])}{(" · " + esc(rng)) if rng else ""}</div>
        </div>
      </header>
      <div class="kpis">{"".join(kpis)}</div>''')

    if d.get("headline"):
        parts.append(f'<p class="headline">{esc(d["headline"])}</p>')

    # Strengths / weaknesses / recommendations
    if d.get("strengths"):
        parts.append(f'<section><h2 class="h-win">{esc(t["strengths"])}</h2>{ul(d["strengths"],"good")}</section>')
    if d.get("weaknesses"):
        parts.append(f'<section><h2 class="h-loss">{esc(t["weaknesses"])}</h2>{ul(d["weaknesses"],"bad")}</section>')
    if d.get("recommendations"):
        parts.append(f'<section><h2 class="h-accent">{esc(t["recs"])}</h2>{ul(d["recommendations"],"rec")}</section>')

    # Performance by color
    cp = d.get("colorPerformance")
    if cp:
        rows = ""
        for c in cp:
            name = t["white"] if c.get("color") == "white" else t["black"]
            wr = c.get("winRate", 0)
            tot = c.get("total", "")
            rows += bar(name, wr, C["accent"], f'{wr}% · {tot}')
        parts.append(f'<section><h2>{esc(t["color"])}</h2><div class="bars">{rows}</div></section>')

    # Accuracy distribution
    ad = d.get("accuracyDistribution")
    if ad:
        mx = max((b.get("count", 0) for b in ad), default=0) or 1
        rows = ""
        for b in ad:
            cnt = b.get("count", 0)
            rows += bar(b.get("bucket", ""), cnt / mx * 100, C["draw"], str(cnt))
        parts.append(f'<section><h2>{esc(t["accuracy"])}</h2><div class="bars">{rows}</div></section>')

    # Monthly trend
    mt = d.get("monthlyTrend")
    if mt:
        rows = ""
        for m in mt:
            wr = m.get("winRate", 0)
            col = C["win"] if wr >= 50 else C["loss"]
            rows += bar(m.get("month", ""), wr, col, f'{wr}% · {m.get("games","")}')
        parts.append(f'<section><h2>{esc(t["monthly"])}</h2><div class="bars">{rows}</div></section>')

    # Top openings table
    ops = d.get("topOpenings")
    if ops:
        trs = ""
        for o in ops:
            net = o.get("netScore", 0)
            net_col = C["win"] if net > 0 else C["loss"] if net < 0 else C["sub"]
            trs += (f'<tr><td>{esc(o.get("name",""))}</td>'
                    f'<td class="num">{esc(o.get("games",""))}</td>'
                    f'<td class="num">{esc(o.get("winRate",""))}%</td>'
                    f'<td class="num" style="color:{net_col}">{"+" if net>0 else ""}{esc(net)}</td></tr>')
        parts.append(f'''<section><h2>{esc(t["openings"])}</h2>
          <table><thead><tr><th>{esc(t["op"])}</th><th class="num">{esc(t["games"])}</th>
          <th class="num">{esc(t["winRate"])}</th><th class="num">{esc(t["net"])}</th></tr></thead>
          <tbody>{trs}</tbody></table></section>''')

    parts.append(f'<footer>{esc(t["generated"])}: {gen} · {esc(t["disclaimer"])}</footer>')

    body = "\n".join(parts)
    return PAGE.format(C=C, body=body, title=esc(t["title"]), player=player)


PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · {player}</title>
<style>
  * {{ box-sizing: border-box; }}
  /* Dark page background fills the margins too (else PDF shows white edges). */
  @page {{ size:A4; margin:1.4cm; background:{C[bg]}; }}
  html {{ background:{C[bg]}; }}
  body {{ margin:0; background:{C[bg]}; color:{C[text]};
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    padding:2rem 1rem; }}
  .wrap {{ max-width:840px; margin:0 auto; }}
  .hero {{ display:flex; justify-content:space-between; align-items:center;
    border-bottom:2px solid {C[accent]}; padding-bottom:1rem; margin-bottom:1.25rem; }}
  .brand {{ color:{C[accent]}; font-weight:800; letter-spacing:.08em; font-size:.7rem;
    text-transform:uppercase; }}
  h1 {{ margin:.15rem 0 .25rem; font-size:1.8rem; }}
  .meta {{ color:{C[sub]}; font-size:.85rem; }}
  .kpis {{ display:flex; flex-wrap:wrap; gap:.6rem; margin-bottom:1.25rem; }}
  /* flex-basis 150px + wrap → KPIs reflow to a new line instead of overflowing the page. */
  .kpi {{ background:{C[card]}; border:1px solid {C[border]}; border-radius:.6rem;
    padding:.6rem .9rem; flex:1 1 150px; min-width:150px; }}
  .kpi-label {{ color:{C[sub]}; font-size:.6rem; text-transform:uppercase; letter-spacing:.06em; }}
  .kpi-value {{ font-size:1.4rem; font-weight:700; margin-top:.15rem; white-space:nowrap; }}
  .headline {{ background:{C[card]}; border-left:3px solid {C[accent]}; border-radius:.4rem;
    padding:.8rem 1rem; color:{C[text]}; line-height:1.5; font-size:.95rem; }}
  section {{ margin:1.25rem 0; }}
  h2 {{ font-size:1.05rem; margin:0 0 .6rem; padding-bottom:.3rem;
    border-bottom:1px solid {C[border]}; }}
  .h-win {{ color:{C[win]}; }} .h-loss {{ color:{C[loss]}; }} .h-accent {{ color:{C[accent]}; }}
  .list {{ margin:0; padding-left:1.1rem; line-height:1.6; font-size:.92rem; }}
  .list li {{ margin:.25rem 0; }}
  .list.rec li {{ list-style:none; position:relative; padding-left:1.2rem; }}
  .list.rec li::before {{ content:"→"; position:absolute; left:0; color:{C[accent]}; font-weight:700; }}
  .bars {{ display:flex; flex-direction:column; gap:.4rem; }}
  .bar-row {{ display:flex; align-items:center; gap:.6rem; font-size:.82rem; }}
  .bar-label {{ width:90px; color:{C[sub]}; flex-shrink:0; }}
  .bar-track {{ flex:1; height:14px; background:{C[item]}; border-radius:7px; overflow:hidden; }}
  .bar-fill {{ display:block; height:100%; border-radius:7px; }}
  .bar-val {{ width:90px; text-align:right; color:{C[text]}; flex-shrink:0; }}
  table {{ width:100%; border-collapse:collapse; font-size:.85rem; }}
  th, td {{ text-align:left; padding:.4rem .5rem; border-bottom:1px solid {C[border]}; }}
  th {{ color:{C[sub]}; font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }}
  .num {{ text-align:right; }}
  footer {{ margin-top:1.5rem; padding-top:.8rem; border-top:1px solid {C[border]};
    color:{C[sub]}; font-size:.7rem; text-align:center; }}
  @media print {{
    body {{ padding:0; }}
    /* Keep individual blocks/rows from being split across pages. */
    .kpi, .headline, .bar-row, tr, li {{ break-inside:avoid; }}
    table, .bars {{ break-inside:avoid; }}
    h2 {{ break-after:avoid; }}
  }}
</style></head>
<body><div class="wrap">{body}</div></body></html>
"""


# ── PDF generation ────────────────────────────────────────────────────────────
def write_pdf(d, html_str, out_path):
    """Write a PDF. Try weasyprint (renders our HTML 1:1), then reportlab. Returns the
    engine name used, or raises RuntimeError if no engine is available."""
    try:
        from weasyprint import HTML  # best fidelity — uses the exact report HTML/CSS
        HTML(string=html_str).write_pdf(out_path)
        return "weasyprint"
    except ImportError:
        pass
    except Exception as e:  # weasyprint present but failed (e.g. missing system libs)
        print(f"  weasyprint failed ({e}); falling back to reportlab", flush=True)

    try:
        _pdf_reportlab(d, out_path)
        return "reportlab"
    except ImportError:
        raise RuntimeError(
            "No PDF engine available (need weasyprint or reportlab). "
            "Deliver the HTML report instead and open it in a browser → Print → Save as PDF."
        )


def _pdf_reportlab(d, out_path):
    """Clean, print-friendly branded PDF built directly from the content (no HTML engine).
    Light background for printing, with ChessAnalytics accent colors."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, ListFlowable, ListItem, HRFlowable)

    t = L.get(d.get("lang", "en"), L["en"])
    accent = colors.HexColor(C["accent"])
    win = colors.HexColor(C["win"]); loss = colors.HexColor(C["loss"])
    ink = colors.HexColor("#0a0b0e"); sub = colors.HexColor("#64748b")
    line = colors.HexColor("#e2e8f0")

    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=22, spaceAfter=2, textColor=ink)
    brand = ParagraphStyle("brand", parent=ss["Normal"], fontSize=8, textColor=accent,
                           spaceAfter=0, leading=10)
    meta = ParagraphStyle("meta", parent=ss["Normal"], fontSize=9, textColor=sub, spaceAfter=8)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, textColor=ink,
                        spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, leading=14, textColor=ink)
    foot = ParagraphStyle("foot", parent=ss["Normal"], fontSize=7, textColor=sub, alignment=1)

    dr = d.get("dateRange") or {}
    rng = f'{dr.get("from","")} – {dr.get("to","")}'.strip(" –")
    story = [Paragraph("CHESSANALYTICS", brand),
             Paragraph(esc(d.get("player", "—")), h1),
             Paragraph(f'{esc(t["title"])}{(" · " + esc(rng)) if rng else ""}', meta),
             HRFlowable(width="100%", thickness=1.5, color=accent, spaceAfter=8)]

    # KPI table
    s = d.get("summary") or {}
    main_tc = s.get("mainTimeClass")
    cur = (s.get("currentEloByTimeClass") or {}).get(main_tc) if main_tc else None
    peak = (s.get("peakEloByTimeClass") or {}).get(main_tc) if main_tc else None
    cells, vals = [], []
    def add_kpi(label, value):
        cells.append(Paragraph(f'<font size=7 color="#64748b">{esc(label)}</font>', body))
        vals.append(Paragraph(f'<b>{esc(value)}</b>', ParagraphStyle("v", parent=body, fontSize=14)))
    if "totalGames" in s: add_kpi(t["games"], s["totalGames"])
    if "winRate" in s: add_kpi(t["winRate"], f'{s["winRate"]}%')
    if cur is not None: add_kpi(f'{t["elo"]} ({main_tc})', cur)
    if peak is not None: add_kpi(f'{t["peak"]} {t["elo"]}', peak)
    if {"wins", "losses", "draws"} <= s.keys(): add_kpi("W–D–L", f'{s["wins"]}–{s["draws"]}–{s["losses"]}')
    if cells:
        kt = Table([cells, vals], colWidths=[ (170*mm)/len(cells) ]*len(cells))
        kt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                                ("BOX", (0, 0), (-1, -1), 0.5, line),
                                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
                                ("TOPPADDING", (0, 0), (-1, -1), 6),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                                ("LEFTPADDING", (0, 0), (-1, -1), 8)]))
        story += [kt, Spacer(1, 8)]

    if d.get("headline"):
        story.append(Paragraph(esc(d["headline"]), body))

    # Print-friendly accent colors (the neon dark-theme palette is unreadable on white).
    P_WIN, P_LOSS, P_ACCENT = "#0a8f5b", "#cc0000", "#0369a1"

    def section(title, items, bullet="•", color_hex="#0a0b0e"):
        if not items:
            return
        story.append(Paragraph(f'<font color="{color_hex}">{esc(title)}</font>', h2))
        for x in items:
            story.append(Paragraph(
                f'<font color="{P_ACCENT}">{bullet}</font>&nbsp;&nbsp;{esc(x)}',
                ParagraphStyle("li", parent=body, leftIndent=10, spaceAfter=2)))

    section(t["strengths"], d.get("strengths"), color_hex=P_WIN)
    section(t["weaknesses"], d.get("weaknesses"), color_hex=P_LOSS)
    # "»" is WinAnsi-safe; "→" is not in reportlab's standard fonts.
    section(t["recs"], d.get("recommendations"), bullet="»", color_hex=P_ACCENT)

    def table(title, header, rows, widths):
        if not rows:
            return
        story.append(Paragraph(esc(title), h2))
        data_rows = [[Paragraph(f'<b>{esc(c)}</b>', ParagraphStyle("th", parent=body,
                     fontSize=8, textColor=colors.white)) for c in header]]
        data_rows += rows
        tb = Table(data_rows, colWidths=widths, hAlign="LEFT")
        tb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), ink),
                                ("GRID", (0, 0), (-1, -1), 0.5, line),
                                ("TOPPADDING", (0, 0), (-1, -1), 4),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                                ("LEFTPADDING", (0, 0), (-1, -1), 6)]))
        story += [tb, Spacer(1, 4)]

    def cell(txt, color=None, align="LEFT"):
        col = f' color="{color}"' if color else ""
        st = ParagraphStyle("c", parent=body, fontSize=9, alignment={"LEFT": 0, "RIGHT": 2}[align])
        return Paragraph(f'<font{col}>{esc(txt)}</font>', st)

    cp = d.get("colorPerformance")
    if cp:
        rows = [[cell(t["white"] if c.get("color") == "white" else t["black"]),
                 cell(f'{c.get("winRate",0)}%', align="RIGHT"),
                 cell(c.get("total", ""), align="RIGHT")] for c in cp]
        table(t["color"], [t["op"], t["winRate"], t["games"]], rows, [90*mm, 40*mm, 40*mm])

    ad = d.get("accuracyDistribution")
    if ad:
        rows = [[cell(b.get("bucket", "")), cell(b.get("count", 0), align="RIGHT")] for b in ad]
        table(t["accuracy"], ["", t["games"]], rows, [130*mm, 40*mm])

    mt = d.get("monthlyTrend")
    if mt:
        rows = []
        for m in mt:
            wr = m.get("winRate", 0)
            rows.append([cell(m.get("month", "")),
                         cell(f'{wr}%', "#00aa66" if wr >= 50 else "#cc0000", "RIGHT"),
                         cell(m.get("games", ""), align="RIGHT")])
        table(t["monthly"], ["", t["winRate"], t["games"]], rows, [90*mm, 40*mm, 40*mm])

    ops = d.get("topOpenings")
    if ops:
        rows = []
        for o in ops:
            net = o.get("netScore", 0)
            ncol = "#00aa66" if net > 0 else "#cc0000" if net < 0 else "#64748b"
            rows.append([cell(o.get("name", "")), cell(o.get("games", ""), align="RIGHT"),
                         cell(f'{o.get("winRate","")}%', align="RIGHT"),
                         cell(f'{"+" if net>0 else ""}{net}', ncol, "RIGHT")])
        table(t["openings"], [t["op"], t["games"], t["winRate"], t["net"]],
              rows, [95*mm, 25*mm, 25*mm, 25*mm])

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    story += [Spacer(1, 10), HRFlowable(width="100%", thickness=0.5, color=line, spaceAfter=4),
              Paragraph(f'{esc(t["generated"])}: {gen} · {esc(t["disclaimer"])}', foot)]

    SimpleDocTemplate(out_path, pagesize=A4, topMargin=18*mm, bottomMargin=16*mm,
                      leftMargin=20*mm, rightMargin=20*mm,
                      title=f'{t["title"]} - {d.get("player","")}').build(story)


def _strip_ext(path):
    for ext in (".html", ".pdf", ".htm"):
        if path.lower().endswith(ext):
            return path[: -len(ext)]
    return path


def main():
    p = argparse.ArgumentParser(description="Render a ChessAnalytics-styled report (HTML/PDF).")
    p.add_argument("--input", required=True, help="report content JSON file")
    p.add_argument("--format", choices=["html", "pdf", "both"], default="html")
    p.add_argument("--output", help="output path (extension set by --format)")
    args = p.parse_args()

    with open(args.input, encoding="utf-8") as f:
        data = json.load(f)
    html_out = build_html(data)

    if args.format in ("html", "both"):
        out = args.output if (args.output and args.format == "html") else _strip_ext(args.output or "report") + ".html"
        with open(out, "w", encoding="utf-8") as f:
            f.write(html_out)
        print(f"wrote {out} ({len(html_out)} bytes)")

    if args.format in ("pdf", "both"):
        out = args.output if (args.output and args.format == "pdf") else _strip_ext(args.output or "report") + ".pdf"
        engine = write_pdf(data, html_out, out)
        print(f"wrote {out} (engine: {engine})")


if __name__ == "__main__":
    main()
