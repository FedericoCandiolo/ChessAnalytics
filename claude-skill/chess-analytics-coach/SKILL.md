---
name: chess-analytics-coach
description: Analyze a chess player's Chess.com performance and give coaching recommendations. Use when the user pastes a ChessAnalytics "Export for AI" report, asks to analyze their or someone's chess games, wants insights on openings / time controls / accuracy / win rate, or asks for chess improvement advice based on Chess.com data. Reads the pasted ChessAnalytics JSON export by default and fetches the Chess.com public API directly only when game-level detail is required.
---

# Chess Analytics Coach

Turn a player's aggregated Chess.com statistics into clear, actionable chess-coaching
advice. The data comes from **ChessAnalytics** (a dashboard that already filters and
aggregates a player's games).

## 1. Choose the data path

There are two sources. **Prefer the export.** Only fetch Chess.com when the export
cannot answer the question.

| Situation | Path |
|---|---|
| User pasted a ChessAnalytics report (text containing `DATA:` / `DATOS:` + a JSON block) | **Use the export** (Section 2) |
| User gives only a username, or no data at all | Ask them to paste their export, OR offer to fetch (Section 3) |
| The export lacks the needed detail — e.g. *which specific games* were lost in an opening, per-game accuracy, exact opponents, dates of a slump | **Fetch detail** from Chess.com (Section 3) |

The export is an aggregate snapshot of whatever filters the user had applied in the app
(time class, date range, color, etc.). It is the right basis for an overall assessment.
Chess.com is the fallback for drilling into specifics the aggregate omits.

## 2. Reading the export (default path)

The pasted text is a prompt followed by a JSON object after `DATA:` (English) or
`DATOS:` (Spanish). Extract and parse that JSON object.

For the full field-by-field schema and how to interpret each metric, read
[reference/export-schema.md](reference/export-schema.md).

Key gotchas:
- `medianNetScore` ranges from **-1** (all losses) to **+1** (all wins); 0 is balanced.
- Opening `netScore` = wins − losses (practical result, not win rate).
- `topOpenings` is capped at the 20 most-played; absence of an opening ≠ never played.
- ELO is reported **per time class**, not a single number.

## 3. Fetching detail from Chess.com (escalation path)

Only when the export is insufficient. Two ways, in order of preference:

**a) Run the bundled script** (when the sandbox has network access):
```
python scripts/analyze_chesscom.py <username> --from YYYY-MM-DD --to YYYY-MM-DD [--time-class blitz] [--detail]
```
It mirrors ChessAnalytics' own aggregation and adds game-level detail (recent losses,
per-opening breakdown, accuracy by time class). Output is JSON on stdout. Match the
date range / time class to the filters implied by the user's export or question.

**b) If the script can't reach the network**, fetch specific months directly. The
endpoints and aggregation rules are in [reference/chesscom-api.md](reference/chesscom-api.md).
Target only the months you need (e.g. the month of a reported slump) — do not pull a
player's entire history game-by-game.

Always set a descriptive `User-Agent` header; Chess.com rejects requests without one.

## 4. Analysis methodology

Produce a coach's read, not a data dump. Apply these lenses:

- **Overall level & trajectory** — ELO per main time class, overall win rate, and the
  `monthlyTrend` direction (improving / flat / declining). ~50% win rate means a stable
  ladder; consistently higher means actively climbing.
- **Color imbalance** — a gap >8–10 pts in win rate between White and Black points to a
  weak repertoire on the worse side. Name the side and recommend study there.
- **Opening repertoire** — separate *mains* (high `games`) from *leaks* (enough volume,
  say ≥8–10 games, but low `winRate` or negative `netScore`). Leaks are the highest-ROI
  study targets. Praise the strongest main lines.
- **Accuracy profile** — a heavy `<50` / `50-59` tail signals blunders / calculation
  errors → tactics training and, if they play mostly bullet, trying slower controls.
  A healthy `80-89` / `90+` mass with poor results points to strategy/endgame, not
  tactics.
- **Tilt & fatigue** — weekdays with strongly negative `medianNetScore` (especially with
  high `gamesPlayed`) suggest session-length or emotional-control issues.

## 5. Output format

Respond in the **same language as the user / their export** (Spanish export → Spanish).
Structure:

1. **Summary** — 2–3 sentences: level, primary time control, win rate, trend.
2. **Top 3 strengths** — concrete, each tied to a number from the data.
3. **Top 3 weaknesses** — concrete, each tied to a number.
4. **3–5 recommendations** — specific and actionable (name the opening to study, the
   training type, the time-control change), ordered by expected impact.
5. *(optional)* **Deep dive** — if you fetched detail, surface the specific games /
   patterns found.

Cite the numbers you used ("47% with Black across 112 games") so the advice is grounded.
Never invent stats that aren't in the data — if something is needed and missing, say so
or fetch it.
