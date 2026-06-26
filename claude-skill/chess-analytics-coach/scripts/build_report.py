#!/usr/bin/env python3
"""Render a polished coaching report in the ChessAnalytics visual style — HTML and/or PDF.

This produces ONE consistent, branded layout (dark header + KPIs, openings table,
color/accuracy panels, weekday grid, monthly trend, strengths/weaknesses cards, numbered
recommendations). Claude supplies the analysis text; this script owns the look so every
report is identical in style.

Usage:
    python scripts/build_report.py --input report.json --format html   # default
    python scripts/build_report.py --input report.json --format pdf
    python scripts/build_report.py --input report.json --format both

PDF uses weasyprint if present (renders this exact HTML, brand-perfect), else a simpler
reportlab fallback, else writes HTML and asks you to Print → Save as PDF.

Input JSON schema (everything except `player` is optional; sections render only if given):

    {
      "player": "fede",
      "lang": "es" | "en",                       # default "en"
      "dateRange": {"from": "2025-01-01", "to": "2026-06-26"},
      "headline": "optional 1-2 sentence intro",
      "summary": {
        "totalGames": 334, "wins": 158, "losses": 147, "draws": 29, "winRate": 47,
        "mainTimeClass": "rapid",
        "currentEloByTimeClass": {"rapid": 970},
        "peakEloByTimeClass":    {"rapid": 982}
      },
      "topOpenings": [
        {"name": "...", "family": "...", "games": 78, "wins": 41, "losses": 32,
         "netScore": 9, "winRate": 53}
      ],
      "colorPerformance": [
        {"color": "white", "wins": 76, "draws": 13, "losses": 77, "total": 166, "winRate": 46},
        {"color": "black", "wins": 82, "draws": 16, "losses": 70, "total": 168, "winRate": 49}
      ],
      "accuracyDistribution": [{"bucket": "<50", "count": 10}, ... "90+"],
      "weekdayPerformance": [{"day": "Monday", "gamesPlayed": 50, "medianNetScore": 1}, ...],
      "monthlyTrend": [{"month": "2025-07", "winRate": 46, "games": 46}, ...],
      # strengths/weaknesses/recommendations: list of {"title","text"} OR plain strings
      "strengths":       [{"title": "D00", "text": "78 games, netScore +9..."}],
      "weaknesses":      [{"title": "A40", "text": "..."}],
      "recommendations": [{"title": "...", "text": "..."}]
    }
"""

import argparse
import html
import json
from datetime import datetime, timezone

# ── ChessAnalytics-aligned palette ──────────────────────────────────────────────
# Dark header uses the app's exact tokens (neon on near-black). Light body uses
# legible brand-derived hues.
ACC_COLORS = ["#e0392f", "#eb6834", "#d98c00", "#0a8fd0", "#10a572", "#5b46c0"]
BUCKETS = ["<50", "50-59", "60-69", "70-79", "80-89", "90+"]

L = {
    "en": {
        "brandLine": "ChessAnalytics · Performance Report", "analysisOf": "Analysis of",
        "generated": "Generated", "period": "Period", "source": "Source: Chess.com",
        "current": "current", "peak": "Peak", "elo": "ELO", "gamesAnalyzed": "Games analyzed",
        "mainTc": "Main time control", "winRateKpi": "Win rate", "precision": "Typical accuracy",
        "mostFrequent": "Most frequent range", "games": "games", "wl": ("W", "D", "L"),
        "openingsH": "Opening performance — Top 6", "colorH": "Performance by piece color",
        "accuracyH": "Accuracy distribution", "weekdayH": "Performance by weekday (medianNetScore)",
        "monthlyH": "Monthly trend — win rate", "strengthsH": "Top strengths",
        "weaknessesH": "Top weaknesses", "recsH": "Coach's recommendations",
        "opening": "Opening", "family": "Family", "gamesCol": "Games", "winsCol": "Wins",
        "lossesCol": "Losses", "netCol": "NetScore", "winPct": "Win %",
        "white": "White", "black": "Black", "winRateSub": "win rate",
        "wins": "Wins", "draws": "Draws", "losses": "Losses", "total": "Total",
        "below70": "games with accuracy below 70%", "above80": "above 80%",
        "strength": "Strength", "weakness": "Weakness",
        "disclaimer": "Source: Chess.com public API",
        "title": "Performance Report",
        "weekAbbr": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        "tc": {"rapid": "Rapid", "blitz": "Blitz", "bullet": "Bullet", "daily": "Daily"},
        "net": "Net", "op": "Opening",
    },
    "es": {
        "brandLine": "ChessAnalytics · Informe de Rendimiento", "analysisOf": "Análisis de",
        "generated": "Generado el", "period": "Período", "source": "Fuente: Chess.com",
        "current": "actual", "peak": "Pico", "elo": "ELO", "gamesAnalyzed": "Partidas analizadas",
        "mainTc": "Ritmo principal", "winRateKpi": "Tasa de victoria", "precision": "Precisión típica",
        "mostFrequent": "Rango más frecuente", "games": "partidas", "wl": ("V", "T", "D"),
        "openingsH": "Rendimiento por apertura — Top 6", "colorH": "Rendimiento por color de piezas",
        "accuracyH": "Distribución de precisión", "weekdayH": "Rendimiento por día de la semana (medianNetScore)",
        "monthlyH": "Tendencia mensual — tasa de victoria", "strengthsH": "Principales fortalezas",
        "weaknessesH": "Principales debilidades", "recsH": "Recomendaciones del entrenador",
        "opening": "Apertura", "family": "Familia", "gamesCol": "Partidas", "winsCol": "Victorias",
        "lossesCol": "Derrotas", "netCol": "NetScore", "winPct": "% Victoria",
        "white": "Blancas", "black": "Negras", "winRateSub": "tasa de victoria",
        "wins": "Victorias", "draws": "Tablas", "losses": "Derrotas", "total": "Total",
        "below70": "con precisión por debajo del 70%", "above80": "por encima del 80%",
        "strength": "Fortaleza", "weakness": "Debilidad",
        "disclaimer": "Fuente: Chess.com API pública",
        "title": "Informe de Rendimiento",
        "weekAbbr": ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
        "months": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
        "tc": {"rapid": "rápidas", "blitz": "blitz", "bullet": "bullet", "daily": "diarias"},
        "net": "Neto", "op": "Apertura",
    },
}


def esc(s):
    return html.escape("" if s is None else str(s))


def norm_items(items):
    """Accept list of {'title','text'} or plain strings → list of (title, text)."""
    out = []
    for x in (items or []):
        if isinstance(x, dict):
            out.append((x.get("title", ""), x.get("text") or x.get("body") or ""))
        else:
            out.append(("", str(x)))
    return out


def wr_color(w):
    if w >= 50: return "#10a572"
    if w >= 45: return "#0a8fd0"
    if w >= 40: return "#d98c00"
    return "#e0392f"


def fmt_month(ym, t):
    try:
        y, m = ym.split("-")
        return f'{t["months"][int(m) - 1].capitalize()} {y}'
    except Exception:
        return ym


def fmt_range(dr, t):
    if not dr:
        return ""
    f, to = dr.get("from", ""), dr.get("to", "")
    return f'{fmt_month(f[:7], t)} – {fmt_month(to[:7], t)}' if f and to else (f or to)


# ── HTML builder ────────────────────────────────────────────────────────────────
def build_html(d):
    t = L.get(d.get("lang", "en"), L["en"])
    s = d.get("summary") or {}
    main_tc = s.get("mainTimeClass")
    tc_label = t["tc"].get(main_tc, main_tc or "")
    gen = datetime.now(timezone.utc)
    gen_str = (f'{gen.day} {t["months"][gen.month - 1]} {gen.year}' if d.get("lang") == "es"
               else f'{t["months"][gen.month - 1]} {gen.day}, {gen.year}')

    parts = []

    # ── Header ──
    cur = (s.get("currentEloByTimeClass") or {}).get(main_tc) if main_tc else None
    peak = (s.get("peakEloByTimeClass") or {}).get(main_tc) if main_tc else None
    ad = d.get("accuracyDistribution") or []
    acc_map = {b.get("bucket"): b.get("count", 0) for b in ad}
    top_bucket = max(ad, key=lambda b: b.get("count", 0)) if ad else None

    kpis = []
    if cur is not None:
        kpis.append(("accent", f'{t["elo"]} {tc_label} ({t["current"]})', cur,
                     f'{t["peak"]}: {peak}' if peak is not None else ""))
    if "totalGames" in s:
        kpis.append(("", t["gamesAnalyzed"], s["totalGames"],
                     f'{t["mainTc"]}: {tc_label}' if tc_label else ""))
    if "winRate" in s:
        w, dr_, l = s.get("wins", 0), s.get("draws", 0), s.get("losses", 0)
        wl = t["wl"]
        kpis.append(("success", t["winRateKpi"], f'{s["winRate"]}%',
                     f'{w}{wl[0]} · {dr_}{wl[1]} · {l}{wl[2]}'))
    if top_bucket:
        kpis.append(("warn", t["precision"], _bucket_label(top_bucket["bucket"]),
                     f'{t["mostFrequent"]} ({top_bucket.get("count",0)} {t["games"]})'))

    kpi_html = "".join(
        f'<div class="kpi-box"><div class="label">{esc(lbl)}</div>'
        f'<div class="value {cls}">{esc(val)}</div>'
        f'<div class="sub">{esc(sub)}</div></div>'
        for cls, lbl, val, sub in kpis)
    cols = max(1, len(kpis))

    parts.append(f'''
      <div class="header">
        <div class="header-top">
          <div>
            <div class="brand">{esc(t["brandLine"])}</div>
            <h1>{esc(t["analysisOf"])}<br><span>{esc(d.get("player","—"))}</span></h1>
          </div>
          <div class="header-date">
            <strong>{esc(t["generated"])} {esc(gen_str)}</strong>
            {(esc(t["period"]) + ": " + esc(fmt_range(d.get("dateRange"), t)) + "<br>") if d.get("dateRange") else ""}
            {esc(t["source"])}{(" · " + esc(tc_label)) if tc_label else ""}
          </div>
        </div>
        <div class="kpi-row" style="grid-template-columns:repeat({cols},1fr)">{kpi_html}</div>
      </div>''')

    parts.append('<div class="content">')

    if d.get("headline"):
        parts.append(f'<div class="intro">{esc(d["headline"])}</div>')

    # ── Openings ──
    ops = d.get("topOpenings") or []
    if ops:
        rows = ""
        for o in ops[:6]:
            net = o.get("netScore", 0)
            badge = "pos" if net > 0 else "neg" if net < 0 else "neu"
            wr = o.get("winRate", 0)
            col = wr_color(wr)
            rows += (
                f'<tr><td><strong>{esc(o.get("name",""))}</strong></td>'
                f'<td>{esc(o.get("family",""))}</td>'
                f'<td class="c">{esc(o.get("games",""))}</td>'
                f'<td class="c" style="color:#10a572;font-weight:600">{esc(o.get("wins",""))}</td>'
                f'<td class="c" style="color:#e0392f;font-weight:600">{esc(o.get("losses",""))}</td>'
                f'<td class="c"><span class="badge {badge}">{"+" if net>0 else ""}{esc(net)}</span></td>'
                f'<td><div class="win-bar"><div class="bar-track"><div class="bar-fill" '
                f'style="width:{max(0,min(100,wr))}%;background:{col}"></div></div>'
                f'<span style="font-size:11px;font-weight:600;color:{col}">{wr}%</span></div></td></tr>')
        parts.append(
            f'{_sec(t["openingsH"], "#01B6FF")}'
            f'<div class="card" style="padding:0;overflow:hidden"><table><thead><tr>'
            f'<th>{esc(t["opening"])}</th><th>{esc(t["family"])}</th>'
            f'<th class="c">{esc(t["gamesCol"])}</th><th class="c">{esc(t["winsCol"])}</th>'
            f'<th class="c">{esc(t["lossesCol"])}</th><th class="c">{esc(t["netCol"])}</th>'
            f'<th style="min-width:120px">{esc(t["winPct"])}</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>')

    # ── Color + Accuracy (2-col) ──
    cp = d.get("colorPerformance") or []
    color_block = _color_panel(cp, t) if cp else ""
    acc_block = _accuracy_panel(ad, acc_map, t) if ad else ""
    if color_block or acc_block:
        parts.append(f'<div class="grid-2">{color_block}{acc_block}</div>')

    # ── Weekday ──
    wd = d.get("weekdayPerformance") or []
    if wd:
        boxes = ""
        for i, w in enumerate(wd[:7]):
            m = w.get("medianNetScore", 0)
            cls, icon = ("good", "↑") if m > 0 else ("bad", "↓") if m < 0 else ("neutral", "→")
            sign = "+1" if m > 0 else "−1" if m < 0 else "0"
            boxes += (f'<div class="day-box {cls}"><div class="day-name">{esc(t["weekAbbr"][i])}</div>'
                      f'<div class="day-icon">{icon}</div>'
                      f'<div class="day-label">{sign} · {esc(w.get("gamesPlayed",0))} {esc(t["games"])}</div></div>')
        parts.append(f'{_sec(t["weekdayH"], "#10a572")}<div class="days-grid">{boxes}</div>')

    # ── Monthly trend ──
    mt = d.get("monthlyTrend") or []
    if mt:
        def trow(m):
            wr = m.get("winRate", 0); col = wr_color(wr)
            return (f'<div class="trend-row"><span class="trend-month">{esc(fmt_month(m.get("month",""),t))}</span>'
                    f'<div class="trend-track"><div class="trend-fill" style="width:{max(0,min(100,wr))}%;background:{col}"></div></div>'
                    f'<span class="trend-rate" style="color:{col}">{wr}%</span></div>')
        half = (len(mt) + 1) // 2
        left = "".join(trow(m) for m in mt[:half])
        right = "".join(trow(m) for m in mt[half:])
        parts.append(f'{_sec(t["monthlyH"], "#eb6834")}'
                     f'<div class="card" style="padding:16px 24px"><div class="trend-cols">'
                     f'<div>{left}</div><div>{right}</div></div></div>')

    # ── Strengths / Weaknesses ──
    parts.append(_insight_grid(t["strengthsH"], "#10a572", "strength", "★",
                               t["strength"], norm_items(d.get("strengths"))))
    parts.append(_insight_grid(t["weaknessesH"], "#e0392f", "weakness", "⚠",
                               t["weakness"], norm_items(d.get("weaknesses"))))

    # ── Recommendations ──
    recs = norm_items(d.get("recommendations"))
    if recs:
        rc = ""
        for i, (title, text) in enumerate(recs, 1):
            head = f'<h5>{esc(title)}</h5>' if title else ""
            rc += (f'<div class="rec"><div class="rec-num">{i}</div>'
                   f'<div class="rec-body">{head}<p>{esc(text)}</p></div></div>')
        parts.append(f'{_sec(t["recsH"], "#01B6FF")}{rc}')

    parts.append('</div>')  # /content

    parts.append(
        f'<div class="footer"><div class="footer-left"><strong>ChessAnalytics</strong> · '
        f'{esc(t["analysisOf"])} {esc(d.get("player",""))}'
        f'{(" · " + str(s["totalGames"]) + " " + esc(t["games"])) if "totalGames" in s else ""} · '
        f'{esc(t["disclaimer"])}</div>'
        f'<div class="footer-right">{esc(t["generated"])} {esc(gen_str)}</div></div>')

    lang = d.get("lang", "en")
    return (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(t["title"])} · {esc(d.get("player",""))}</title>'
            f'<style>{ROOT_VARS}{CSS}</style></head>'
            f'<body><div class="sheet">{"".join(parts)}</div></body></html>')


def _bucket_label(b):
    return {"<50": "< 50%", "90+": "90%+"}.get(b, f'{b.replace("-", "–")}%')


def _sec(title, dot):
    return (f'<div class="section-header"><div class="dot" style="background:{dot}"></div>'
            f'<h2>{esc(title)}</h2></div>')


def _color_panel(cp, t):
    blocks = ""
    for c in cp:
        is_white = c.get("color") == "white"
        name = t["white"] if is_white else t["black"]
        rate = c.get("winRate", 0)
        w, dr_, l = c.get("wins", 0), c.get("draws", 0), c.get("losses", 0)
        tot = c.get("total", w + dr_ + l)
        rate_col = "#0a8fd0" if is_white else "#5b46c0"
        icon = "background:white" if is_white else "background:#1a1a1a"
        stacked = ""
        if tot:
            stacked = (f'<div class="stacked-bar">'
                       f'<div style="flex:{w};background:#10a572;border-radius:4px 0 0 4px"></div>'
                       f'<div style="flex:{dr_};background:#d98c00"></div>'
                       f'<div style="flex:{l};background:#e0392f;border-radius:0 4px 4px 0"></div></div>')
        blocks += (
            f'<div class="color-block"><div class="color-title">'
            f'<div class="color-icon" style="{icon}"></div>{esc(name)}</div>'
            f'<div class="color-rate" style="color:{rate_col}">{rate}%</div>'
            f'<div class="color-sub">{esc(t["winRateSub"])}</div>'
            f'<div class="color-stat"><span>{esc(t["wins"])}</span><span style="color:#10a572;font-weight:600">{w}</span></div>'
            f'<div class="color-stat"><span>{esc(t["draws"])}</span><span style="color:#d98c00;font-weight:600">{dr_}</span></div>'
            f'<div class="color-stat"><span>{esc(t["losses"])}</span><span style="color:#e0392f;font-weight:600">{l}</span></div>'
            f'<div class="color-stat"><span>{esc(t["total"])}</span><span style="font-weight:600">{tot}</span></div>'
            f'{stacked}</div>')
    return (f'<div>{_sec(t["colorH"], "#5b46c0")}'
            f'<div class="card"><div class="color-perf">{blocks}</div></div></div>')


def _accuracy_panel(ad, acc_map, t):
    mx = max((b.get("count", 0) for b in ad), default=0) or 1
    rows = ""
    order = {b: i for i, b in enumerate(BUCKETS)}
    for b in ad:
        bucket = b.get("bucket", "")
        cnt = b.get("count", 0)
        col = ACC_COLORS[order.get(bucket, 3)]
        rows += (f'<div class="acc-row"><span class="acc-label">{esc(_bucket_label(bucket))}</span>'
                 f'<div class="acc-track"><div class="acc-fill" style="width:{cnt/mx*100:.0f}%;background:{col}"></div></div>'
                 f'<span class="acc-count" style="color:{col}">{cnt}</span></div>')
    total = sum(b.get("count", 0) for b in ad) or 1
    below = acc_map.get("<50", 0) + acc_map.get("50-59", 0) + acc_map.get("60-69", 0)
    above = acc_map.get("80-89", 0) + acc_map.get("90+", 0)
    foot = (f'<div class="acc-foot"><strong>{below} {t["games"]} ({round(below/total*100)}%)</strong> '
            f'{esc(t["below70"])} · <strong>{above} ({round(above/total*100)}%)</strong> {esc(t["above80"])}</div>')
    return (f'<div>{_sec(t["accuracyH"], "#d98c00")}'
            f'<div class="card"><div class="acc-bars">{rows}</div>{foot}</div></div>')


def _insight_grid(title, dot, kind, icon, tag_word, items):
    if not items:
        return ""
    cards = ""
    for i, (h, txt) in enumerate(items, 1):
        head = f'<h4>{esc(h)}</h4>' if h else ""
        cards += (f'<div class="insight {kind}"><div class="tag">{icon} {esc(tag_word)} {i}</div>'
                  f'{head}<p>{esc(txt)}</p></div>')
    return f'{_sec(title, dot)}<div class="grid-3">{cards}</div>'


# ── CSS ──────────────────────────────────────────────────────────────────────────
ROOT_VARS = (
    ":root{"
    "--blue:#0a8fd0;--green:#10a572;--green-light:#e3f5ee;--green-mid:#7fd3b4;"
    "--green-dark:#0c5a45;--green-text:#0f6e56;--amber:#d98c00;--red:#e0392f;"
    "--red-light:#fbe9e6;--red-mid:#f0a08c;--red-dark:#7a2a1a;--red-text:#a83a21;"
    "--purple:#5b46c0;--g900:#1a1a1a;--g700:#3d3d3d;--g500:#6b6b6b;--g300:#d1d1d1;"
    "--g100:#f1f3f5;--g50:#fafbfc;--accent:#01B6FF;}"
)

CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
/* Page margins so the document breathes; dark page edge matches the brand. */
@page{size:A4;margin:1.3cm}
html{background:var(--g100)}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--g900);font-size:14px;line-height:1.5;background:var(--g100);padding:18px}
.sheet{max-width:960px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;
  border:1px solid var(--g100)}
.header{background:linear-gradient(135deg,#0a0b0e 0%,#10212c 55%,#013a52 100%);
  color:#fff;padding:44px 44px 34px}
.header-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:30px}
.brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:6px}
.header h1{font-size:36px;font-weight:700;line-height:1.1;color:#fff}
.header h1 span{color:var(--accent)}
.header-date{font-size:12px;color:rgba(255,255,255,.45);text-align:right}
.header-date strong{display:block;font-size:14px;color:rgba(255,255,255,.7);font-weight:500;margin-bottom:4px}
.kpi-row{display:grid;gap:14px}
.kpi-box{background:rgba(255,255,255,.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(255,255,255,.12)}
.kpi-box .label{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:6px}
.kpi-box .value{font-size:28px;font-weight:700;color:#fff;line-height:1;white-space:nowrap}
.kpi-box .value.accent{color:var(--accent)}
.kpi-box .value.success{color:#00FF9C}
.kpi-box .value.warn{color:#FFD400}
.kpi-box .sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:5px}
.content{padding:36px 44px}
.intro{background:var(--g50);border-left:3px solid var(--accent);border-radius:8px;
  padding:14px 18px;font-size:13px;color:var(--g700);line-height:1.6;margin-bottom:28px}
.section-header{display:flex;align-items:center;gap:10px;margin:0 0 18px;padding-bottom:10px;
  border-bottom:1.5px solid var(--g100)}
.section-header .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.section-header h2{font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--g500)}
.content>table,.content>.card,.content>.grid-2,.content>.days-grid,.content>.grid-3{margin-bottom:34px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:34px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:34px}
.card{background:var(--g50);border-radius:12px;padding:20px 24px;border:1px solid var(--g100)}
.insight{border-radius:12px;padding:16px 18px}
.insight.strength{background:var(--green-light);border:1px solid var(--green-mid)}
.insight.weakness{background:var(--red-light);border:1px solid var(--red-mid)}
.insight .tag{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px}
.insight.strength .tag{color:var(--green-text)}
.insight.weakness .tag{color:var(--red-text)}
.insight h4{font-size:14px;font-weight:600;margin-bottom:6px}
.insight.strength h4{color:var(--green-dark)}
.insight.weakness h4{color:var(--red-dark)}
.insight p{font-size:12px;line-height:1.6}
.insight.strength p{color:var(--green-text)}
.insight.weakness p{color:var(--red-text)}
.rec{display:flex;gap:14px;align-items:flex-start;padding:16px 20px;background:var(--g50);
  border-radius:10px;border:1px solid var(--g100);margin-bottom:12px}
.rec-num{width:26px;height:26px;border-radius:50%;background:#e6f4fb;display:flex;align-items:center;
  justify-content:center;font-size:12px;font-weight:700;color:var(--blue);flex-shrink:0;margin-top:1px}
.rec-body h5{font-size:14px;font-weight:600;color:var(--g900);margin-bottom:5px}
.rec-body p{font-size:12px;color:var(--g500);line-height:1.6}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:8px 12px;background:var(--g100);color:var(--g500);font-size:10px;
  letter-spacing:.06em;text-transform:uppercase;font-weight:600}
td{padding:9px 12px;border-bottom:1px solid var(--g100);color:var(--g700);vertical-align:middle}
tr:last-child td{border-bottom:none}
td.c,th.c{text-align:center}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
.badge.pos{background:var(--green-light);color:var(--green-text)}
.badge.neg{background:var(--red-light);color:var(--red-text)}
.badge.neu{background:#fdf2d6;color:#92660e}
.win-bar{display:flex;align-items:center;gap:6px}
.bar-track{flex:1;height:5px;background:var(--g100);border-radius:3px;min-width:50px}
.bar-fill{height:100%;border-radius:3px}
.color-perf{display:flex;gap:18px}
.color-block{flex:1;background:#fff;border-radius:10px;padding:16px;border:1px solid var(--g100)}
.color-title{font-size:12px;font-weight:600;color:var(--g700);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.color-icon{width:16px;height:16px;border-radius:3px;border:1px solid var(--g300)}
.color-rate{font-size:22px;font-weight:700;margin-bottom:2px}
.color-sub{font-size:11px;color:var(--g500);margin-bottom:10px}
.color-stat{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px}
.color-stat span:first-child{color:var(--g500)}
.stacked-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;margin-top:10px}
.acc-bars{display:flex;flex-direction:column;gap:8px}
.acc-row{display:flex;align-items:center;gap:10px}
.acc-label{font-size:11px;color:var(--g500);min-width:46px;font-weight:500}
.acc-track{flex:1;height:8px;background:var(--g100);border-radius:4px;overflow:hidden}
.acc-fill{height:100%;border-radius:4px}
.acc-count{font-size:11px;color:var(--g500);min-width:26px;text-align:right}
.acc-foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--g100);font-size:11px;color:var(--g500)}
.acc-foot strong{color:var(--g700)}
.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:34px}
.day-box{text-align:center;border-radius:8px;padding:12px 6px;border:1px solid var(--g100)}
.day-name{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;color:var(--g500)}
.day-icon{font-size:18px;margin-bottom:4px}
.day-label{font-size:9px;font-weight:600}
.day-box.good{background:var(--green-light);border-color:var(--green-mid)}
.day-box.good .day-name,.day-box.good .day-label{color:var(--green-text)}
.day-box.bad{background:var(--red-light);border-color:var(--red-mid)}
.day-box.bad .day-name,.day-box.bad .day-label{color:var(--red-text)}
.day-box.neutral{background:#fdf2d6;border-color:#f3dca0}
.day-box.neutral .day-name,.day-box.neutral .day-label{color:#92660e}
.trend-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}
.trend-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--g100)}
.trend-month{font-size:11px;font-weight:600;color:var(--g700);min-width:54px}
.trend-track{flex:1;height:6px;background:var(--g100);border-radius:3px;overflow:hidden}
.trend-fill{height:100%;border-radius:3px}
.trend-rate{font-size:11px;min-width:34px;text-align:right;font-weight:600}
.footer{background:var(--g50);border-top:1px solid var(--g100);padding:18px 44px;display:flex;
  justify-content:space-between;align-items:center;gap:12px}
.footer-left{font-size:11px;color:var(--g500)}
.footer-right{font-size:11px;color:var(--g300)}
@media print{
  body{padding:0;background:#fff}
  .sheet{max-width:none;border:none;border-radius:0}
  .section-header,.insight,.rec,.day-box,.color-block,.kpi-box,tr,.trend-row{break-inside:avoid}
  table,.grid-2,.days-grid,.card{break-inside:avoid}
  h2,.section-header{break-after:avoid}
}
"""


# ── PDF ──────────────────────────────────────────────────────────────────────────
def write_pdf(d, html_str, out_path):
    try:
        from weasyprint import HTML
        HTML(string=html_str).write_pdf(out_path)
        return "weasyprint"
    except ImportError:
        pass
    except Exception as e:
        print(f"  weasyprint failed ({e}); falling back to reportlab", flush=True)
    try:
        _pdf_reportlab(d, out_path)
        return "reportlab"
    except ImportError:
        raise RuntimeError(
            "No PDF engine available (need weasyprint or reportlab). "
            "Deliver the HTML report instead and open it in a browser → Print → Save as PDF.")


def _pdf_reportlab(d, out_path):
    """Simpler print-friendly fallback (used only if weasyprint is absent)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, HRFlowable)

    t = L.get(d.get("lang", "en"), L["en"])
    ink = colors.HexColor("#0a0b0e"); sub = colors.HexColor("#64748b")
    line = colors.HexColor("#e2e8f0"); accent = colors.HexColor("#01B6FF")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=20, spaceAfter=2, textColor=ink)
    brand = ParagraphStyle("brand", parent=ss["Normal"], fontSize=8, textColor=accent, leading=10)
    meta = ParagraphStyle("meta", parent=ss["Normal"], fontSize=9, textColor=sub, spaceAfter=8)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, textColor=ink, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, leading=14, textColor=ink)
    foot = ParagraphStyle("foot", parent=ss["Normal"], fontSize=7, textColor=sub, alignment=1)

    story = [Paragraph("CHESSANALYTICS", brand), Paragraph(esc(d.get("player", "—")), h1),
             Paragraph(esc(t["title"]) + " · " + esc(fmt_range(d.get("dateRange"), t)), meta),
             HRFlowable(width="100%", thickness=1.5, color=accent, spaceAfter=8)]

    def sec(title, items, color):
        if not items:
            return
        story.append(Paragraph(f'<font color="{color}">{esc(title)}</font>', h2))
        for h, txt in norm_items(items):
            prefix = f'<b>{esc(h)}:</b> ' if h else ""
            story.append(Paragraph(f'<font color="#0369a1">•</font>&nbsp;&nbsp;{prefix}{esc(txt)}',
                                   ParagraphStyle("li", parent=body, leftIndent=10, spaceAfter=3)))

    sec(t["strengthsH"], d.get("strengths"), "#0a8f5b")
    sec(t["weaknessesH"], d.get("weaknesses"), "#cc0000")
    sec(t["recsH"], d.get("recommendations"), "#0369a1")

    ops = d.get("topOpenings") or []
    if ops:
        story.append(Paragraph(esc(t["openingsH"]), h2))
        rows = [[Paragraph(f'<b>{esc(c)}</b>', ParagraphStyle("th", parent=body, fontSize=8, textColor=colors.white))
                 for c in [t["op"], t["gamesCol"], t["winPct"], t["net"]]]]
        for o in ops[:8]:
            rows.append([Paragraph(esc(o.get("name", "")), body),
                         Paragraph(esc(o.get("games", "")), body),
                         Paragraph(f'{o.get("winRate","")}%', body),
                         Paragraph(f'{"+" if o.get("netScore",0)>0 else ""}{o.get("netScore",0)}', body)])
        tb = Table(rows, colWidths=[95 * mm, 25 * mm, 25 * mm, 25 * mm])
        tb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), ink), ("GRID", (0, 0), (-1, -1), 0.5, line),
                                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story += [tb, Spacer(1, 6)]

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    story += [Spacer(1, 8), HRFlowable(width="100%", thickness=0.5, color=line, spaceAfter=4),
              Paragraph(f'{esc(t["generated"])} {gen} · {esc(t["disclaimer"])}', foot)]
    SimpleDocTemplate(out_path, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm,
                      leftMargin=20 * mm, rightMargin=20 * mm).build(story)


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
