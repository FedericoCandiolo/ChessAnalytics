#!/usr/bin/env python3
"""Aggregate a player's Chess.com games the same way the ChessAnalytics dashboard does.

Two data modes:

  --input  : aggregate archive JSON that was ALREADY fetched (e.g. by Claude's web-fetch
             tool and saved to files). Use this in sandboxes WITHOUT network access.
             Each input file may be a Chess.com month archive ({"games": [...]}) or a
             bare list of game objects.

  (default): fetch directly from the Chess.com public API. Use this only where the
             environment has outbound network (e.g. Claude Code, a local shell).

Examples
--------
    # Sandbox: Claude saved the month files, script just aggregates them
    python analyze_chesscom.py fede --input ./archives --detail

    # Networked env: let the script fetch
    python analyze_chesscom.py hikaru --from 2024-01-01 --to 2024-06-30 --time-class blitz

Output: a JSON object on stdout. Progress / warnings go to stderr.
"""

import argparse
import glob
import json
import os
import re
import sys
import statistics
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = "https://api.chess.com/pub"
UA = "ChessAnalyticsCoach/1.0 (chess analytics skill)"

DRAW_RESULTS = {
    "agreed", "repetition", "stalemate", "insufficient",
    "50move", "timevsinsufficient",
    "50rule", "time_vs_insufficient",  # legacy/alternate spellings
}
ECO_FAMILY = {"A": "Flank", "B": "Semi-Open", "C": "Open", "D": "Closed", "E": "Indian"}
ACC_BUCKETS = ["<50", "50-59", "60-69", "70-79", "80-89", "90+"]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

ECO_RE = re.compile(r'\[ECO "([^"]+)"\]')
ECOURL_RE = re.compile(r'\[ECOUrl "https://www\.chess\.com/openings/([^"]+)"\]')


def log(*a):
    print(*a, file=sys.stderr)


def get_json(url):
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def acc_bucket(a):
    if a < 50: return "<50"
    if a < 60: return "50-59"
    if a < 70: return "60-69"
    if a < 80: return "70-79"
    if a < 90: return "80-89"
    return "90+"


def slim_game(g, user_lower):
    white = g.get("white", {})
    black = g.get("black", {})
    is_white = white.get("username", "").lower() == user_lower
    me = white if is_white else black
    opp = black if is_white else white

    ts = g.get("end_time", 0)
    d = datetime.fromtimestamp(ts, tz=timezone.utc)
    pgn = g.get("pgn", "") or ""
    eco_m = ECO_RE.search(pgn)
    eco = eco_m.group(1) if eco_m else "N/A"
    slug_m = ECOURL_RE.search(pgn)
    opening = slug_m.group(1).replace("-", " ") if slug_m else eco

    res = me.get("result", "")
    outcome = "win" if res == "win" else ("draw" if res in DRAW_RESULTS else "loss")

    acc = None
    accs = g.get("accuracies")
    if accs:
        v = accs.get("white" if is_white else "black")
        if v is not None:
            acc = round(v)

    return {
        "url": g.get("url"),
        "date": d.strftime("%Y-%m-%d"),
        "month": d.strftime("%Y-%m"),
        "weekday": d.weekday(),  # Monday=0 .. Sunday=6 (matches the app)
        "color": "white" if is_white else "black",
        "rating": me.get("rating"),
        "opponent": opp.get("username"),
        "opponent_rating": opp.get("rating"),
        "time_class": g.get("time_class"),
        "rated": bool(g.get("rated")),
        "eco": eco,
        "family": ECO_FAMILY.get(eco[:1], "Other"),
        "opening": opening,
        "accuracy": acc,
        "outcome": outcome,
        "termination": res,
        "timestamp": ts,
    }


def passes_filters(sg, date_from, date_to, time_class, rated, color):
    if not (date_from <= sg["date"] <= date_to):
        return False
    if time_class and sg["time_class"] != time_class:
        return False
    if rated is not None and sg["rated"] != rated:
        return False
    if color and sg["color"] != color:
        return False
    return True


def month_overlaps(url, date_from, date_to):
    m = re.search(r"/(\d{4})/(\d{2})$", url)
    if not m:
        return False
    start = f"{m.group(1)}-{m.group(2)}-01"
    end = f"{m.group(1)}-{m.group(2)}-31"
    return start <= date_to and end >= date_from


def raw_games_from_input(path):
    """Load raw game objects from a file or directory of saved Chess.com archive JSON."""
    files = []
    if os.path.isdir(path):
        files = sorted(glob.glob(os.path.join(path, "*.json")))
    elif os.path.isfile(path):
        files = [path]
    if not files:
        log(f"ERROR: no JSON files found at {path}")
        sys.exit(1)

    raw = []
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as e:
            log(f"  warn: could not read {f} ({e}); skipping")
            continue
        if isinstance(data, dict) and "games" in data:
            raw.extend(data["games"])
        elif isinstance(data, list):
            raw.extend(data)
        else:
            log(f"  warn: {f} is not a month archive or game list; skipping")
    log(f"loaded {len(raw)} raw games from {len(files)} file(s)")
    return raw


def raw_games_from_network(username, date_from, date_to):
    user_lower = username.lower()
    try:
        archives = get_json(f"{API}/player/{user_lower}/games/archives").get("archives", [])
    except HTTPError as e:
        log(f"ERROR: user '{username}' not found or API error ({e.code}).")
        sys.exit(1)
    except URLError as e:
        log(f"ERROR: no network ({e.reason}). In a sandbox, let Claude web-fetch the "
            f"month archives, save them, and re-run with --input <dir>.")
        sys.exit(2)

    urls = [u for u in archives if month_overlaps(u, date_from, date_to)]
    log(f"{len(urls)} archive month(s) overlap {date_from}..{date_to}")
    raw = []
    for u in urls:
        try:
            raw.extend(get_json(u).get("games", []))
        except (HTTPError, URLError) as e:
            log(f"  warn: failed {u} ({e}); skipping")
    return raw


def build_games(raw, username, date_from, date_to, time_class, rated, color):
    user_lower = username.lower()
    games = [slim_game(g, user_lower) for g in raw]
    games = [g for g in games if passes_filters(g, date_from, date_to, time_class, rated, color)]
    games.sort(key=lambda x: x["timestamp"])
    log(f"{len(games)} games after filtering ({date_from}..{date_to})")
    return games


def aggregate(username, games, date_from, date_to, detail):
    counts = {"win": 0, "draw": 0, "loss": 0}
    by_color = {c: {"wins": 0, "draws": 0, "losses": 0} for c in ("white", "black")}
    acc_dist = {b: 0 for b in ACC_BUCKETS}
    openings = {}
    months = {}
    weekday_scores = [[] for _ in range(7)]
    elo_by_tc = {}

    def bump(d, outcome):
        d["wins" if outcome == "win" else "draws" if outcome == "draw" else "losses"] += 1

    for g in games:
        counts[g["outcome"]] += 1
        bump(by_color[g["color"]], g["outcome"])

        if g["accuracy"] is not None:
            acc_dist[acc_bucket(g["accuracy"])] += 1

        op = openings.setdefault(g["opening"], {
            "name": g["opening"], "family": g["family"],
            "wins": 0, "draws": 0, "losses": 0, "games": 0,
        })
        bump(op, g["outcome"])
        op["games"] += 1

        m = months.setdefault(g["month"], {"month": g["month"], "wins": 0, "draws": 0, "losses": 0, "games": 0})
        bump(m, g["outcome"])
        m["games"] += 1

        weekday_scores[g["weekday"]].append(1 if g["outcome"] == "win" else -1 if g["outcome"] == "loss" else 0)

        if g["rating"] is not None:
            elo_by_tc.setdefault(g["time_class"], []).append(g["rating"])

    total = len(games)

    def wr(w, t):
        return round(w / t * 100) if t else 0

    for c in by_color.values():
        c["total"] = c["wins"] + c["draws"] + c["losses"]
        c["winRate"] = wr(c["wins"], c["total"])

    op_list = []
    for op in openings.values():
        op["netScore"] = op["wins"] - op["losses"]
        op["winRate"] = wr(op["wins"], op["games"])
        op_list.append(op)
    op_list.sort(key=lambda o: o["games"], reverse=True)

    monthly = sorted(months.values(), key=lambda m: m["month"])
    for m in monthly:
        m["winRate"] = wr(m["wins"], m["games"])

    main_tc = max(elo_by_tc, key=lambda k: len(elo_by_tc[k])) if elo_by_tc else None
    current_elo = {tc: r[-1] for tc, r in elo_by_tc.items()}
    peak_elo = {tc: max(r) for tc, r in elo_by_tc.items()}

    weekday_perf = [{
        "day": WEEKDAYS[i],
        "gamesPlayed": len(s),
        "medianNetScore": round(statistics.median(s), 3) if s else 0,
    } for i, s in enumerate(weekday_scores)]

    result = {
        "username": username,
        "dateRange": {"from": date_from, "to": date_to},
        "summary": {
            "totalGames": total,
            "wins": counts["win"], "losses": counts["loss"], "draws": counts["draw"],
            "winRate": wr(counts["win"], total),
            "mainTimeClass": main_tc,
            "currentEloByTimeClass": current_elo,
            "peakEloByTimeClass": peak_elo,
        },
        "performanceByColor": [
            {"color": "white", **by_color["white"]},
            {"color": "black", **by_color["black"]},
        ],
        "accuracyDistribution": [{"bucket": b, "count": acc_dist[b]} for b in ACC_BUCKETS],
        "openings": op_list,                       # full list, not capped at 20
        "monthlyTrend": monthly,
        "weekdayPerformance": weekday_perf,
    }

    if detail:
        losses = [g for g in games if g["outcome"] == "loss"]
        result["detail"] = {
            "recentLosses": list(reversed(losses[-15:])),  # most recent first
            "accuracyByTimeClass": _acc_by_tc(games),
            "worstOpenings": [o for o in op_list if o["games"] >= 5][-10:][::-1],
            "allGames": games,
        }

    return result


def _acc_by_tc(games):
    buckets = {}
    for g in games:
        if g["accuracy"] is None:
            continue
        buckets.setdefault(g["time_class"], []).append(g["accuracy"])
    return {tc: {"games": len(v), "avgAccuracy": round(sum(v) / len(v), 1)}
            for tc, v in buckets.items()}


def main():
    p = argparse.ArgumentParser(description="Aggregate Chess.com games like ChessAnalytics.")
    p.add_argument("username")
    p.add_argument("--input", help="file or dir of pre-fetched archive JSON (no network needed)")
    p.add_argument("--from", dest="date_from", help="YYYY-MM-DD (default: 3 months ago)")
    p.add_argument("--to", dest="date_to", help="YYYY-MM-DD (default: today)")
    p.add_argument("--time-class", choices=["bullet", "blitz", "rapid", "daily"])
    g = p.add_mutually_exclusive_group()
    g.add_argument("--rated", action="store_true")
    g.add_argument("--unrated", action="store_true")
    p.add_argument("--color", choices=["white", "black"])
    p.add_argument("--detail", action="store_true", help="include game-level breakdown")
    args = p.parse_args()

    today = datetime.now(tz=timezone.utc)
    date_to = args.date_to or today.strftime("%Y-%m-%d")
    if args.date_from:
        date_from = args.date_from
    else:
        # default window: ~3 recent months
        m = today.month - 3
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        date_from = f"{y:04d}-{m:02d}-01"

    rated = True if args.rated else (False if args.unrated else None)

    if args.input:
        raw = raw_games_from_input(args.input)
    else:
        raw = raw_games_from_network(args.username, date_from, date_to)

    games = build_games(raw, args.username, date_from, date_to, args.time_class, rated, args.color)
    out = aggregate(args.username, games, date_from, date_to, args.detail)
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
