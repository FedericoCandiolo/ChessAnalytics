# ChessAnalytics Export Schema

The "Export for AI" button produces a text blob: a short instruction prompt, then the
literal marker `DATA:` (English UI) or `DATOS:` (Spanish UI), then a pretty-printed JSON
object. Parse the JSON that follows the marker.

The stats reflect **the filters the user had active** in the app (time class, date range,
piece color, opening family, rated/unrated, etc.). It is not necessarily the player's
entire history — treat it as "the slice the user chose to look at."

## Top-level shape

```jsonc
{
  "username": "magnuscarlsen",
  "summary": { ... },
  "performanceByColor": [ ... ],   // always two entries: white, black
  "accuracyDistribution": [ ... ], // six fixed buckets
  "topOpenings": [ ... ],          // up to 20, sorted by games played desc
  "monthlyTrend": [ ... ],         // up to last 12 months, chronological
  "weekdayPerformance": [ ... ]    // 7 entries, Monday..Sunday
}
```

## summary

```jsonc
{
  "totalGames": 412,
  "wins": 230,
  "losses": 150,
  "draws": 32,
  "winRate": 56,                          // percent, integer, wins / totalGames
  "mainTimeClass": "blitz",               // most-played time class in the slice
  "currentEloByTimeClass": { "blitz": 2890, "bullet": 3012, "rapid": 2750 },
  "peakEloByTimeClass":    { "blitz": 2945, "bullet": 3050, "rapid": 2801 }
}
```
- ELO is **per time class** — there is no single rating. Compare current vs peak to see
  if the player is near their best or in a dip.

## performanceByColor

```jsonc
[
  { "color": "white", "wins": 130, "draws": 18, "losses": 70, "total": 218, "winRate": 60 },
  { "color": "black", "wins": 100, "draws": 14, "losses": 80, "total": 194, "winRate": 52 }
]
```
- A large White-minus-Black `winRate` gap = repertoire weakness on the worse side.

## accuracyDistribution

```jsonc
[
  { "bucket": "<50",   "count": 12 },
  { "bucket": "50-59", "count": 40 },
  { "bucket": "60-69", "count": 88 },
  { "bucket": "70-79", "count": 110 },
  { "bucket": "80-89", "count": 95 },
  { "bucket": "90+",   "count": 33 }
]
```
- `count` = number of games whose accuracy fell in that band. Only games for which
  Chess.com computed accuracy are included, so the counts may sum to less than
  `totalGames`. A heavy low-end tail → blunders/calculation; a heavy high-end with poor
  results → strategy/endgames.

## topOpenings

```jsonc
[
  {
    "name": "Sicilian Defense: Najdorf Variation",
    "family": "Semi-Abierta",   // ECO family label (may be Spanish: Flanco/Semi-Abierta/Abierta/Cerradas/India)
    "games": 54,
    "wins": 30, "draws": 6, "losses": 18,
    "netScore": 12,             // wins - losses
    "winRate": 56               // percent
  }
]
```
- Sorted by `games` descending, capped at 20. An opening not listed just wasn't in the
  top 20 by volume — do not conclude it was never played.
- **Mains** = high `games`. **Leaks** = decent volume but low `winRate` / negative
  `netScore`. Leaks are the best study targets.
- `family` values come from the app and may be in Spanish: `Flanco` (Flank/A),
  `Semi-Abierta` (Semi-Open/B), `Abierta` (Open/C), `Cerradas` (Closed/D), `India`
  (Indian/E), `Otros` (Other).

## monthlyTrend

```jsonc
[
  { "month": "2024-09", "games": 60, "wins": 33, "draws": 5, "losses": 22, "winRate": 55 }
]
```
- Chronological, up to the last 12 months present in the slice. Read the `winRate`
  sequence for trajectory (improving / flat / declining) and `games` for activity spikes.

## weekdayPerformance

```jsonc
[
  { "day": "Monday", "gamesPlayed": 70, "medianNetScore": 0.0 }
]
```
- Seven entries, Monday→Sunday. `medianNetScore` ∈ [-1, +1]: +1 = all wins, -1 = all
  losses, 0 = balanced. Strongly negative days with high `gamesPlayed` hint at tilt or
  fatigue (e.g. long late-night sessions).

## What the export does NOT contain

Escalate to Chess.com (see `chesscom-api.md` / the fetch script) for any of these:
- Individual games, opponents, or PGNs.
- Per-game accuracy values (only the bucketed distribution is exported).
- Openings beyond the top 20 by volume.
- Anything outside the date range / filters the user had applied.
