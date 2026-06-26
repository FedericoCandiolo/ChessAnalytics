#!/usr/bin/env python3
"""Render a self-contained HTML coaching report in the ChessAnalytics visual style.

Claude assembles the report content (the analysis it produced in the conversation +
the key stats) into a JSON file, then runs:

    python scripts/build_report.py --input report.json --output report.html

The output is a single HTML file with inline CSS (no network, no dependencies). It opens
in any browser and can be "Printed to PDF". Runs fine in the no-network sandbox.

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


def build(d):
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
  .kpis {{ display:flex; flex-wrap:wrap; gap:.75rem; margin-bottom:1.25rem; }}
  .kpi {{ background:{C[card]}; border:1px solid {C[border]}; border-radius:.6rem;
    padding:.7rem 1rem; min-width:110px; flex:1; }}
  .kpi-label {{ color:{C[sub]}; font-size:.6rem; text-transform:uppercase; letter-spacing:.06em; }}
  .kpi-value {{ font-size:1.5rem; font-weight:700; margin-top:.15rem; }}
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
  @media print {{ body {{ padding:0; }} .kpi, .headline, table {{ break-inside:avoid; }} }}
</style></head>
<body><div class="wrap">{body}</div></body></html>
"""


def main():
    p = argparse.ArgumentParser(description="Render a ChessAnalytics-styled HTML report.")
    p.add_argument("--input", required=True, help="report content JSON file")
    p.add_argument("--output", default="report.html", help="output HTML path")
    args = p.parse_args()

    with open(args.input, encoding="utf-8") as f:
        data = json.load(f)
    html_out = build(data)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(html_out)
    print(f"wrote {args.output} ({len(html_out)} bytes)")


if __name__ == "__main__":
    main()
