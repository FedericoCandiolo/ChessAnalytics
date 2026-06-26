# Chess.com Public API — fetch & aggregation reference

The API is public, read-only, and needs no key. Direct HTTP clients should send a
`User-Agent` header (the script does); Claude's web-fetch tool handles this for you.

## Recommended flow on Claude.ai (web-fetch + sandbox aggregate)

The aggregation script runs in a sandbox **without** network. So **Claude web-fetches**
the data and the script crunches the saved files:

1. Web-fetch the archive index, keep the months overlapping the window.
2. Web-fetch each needed month URL and **save the response JSON** to
   `archives/YYYY_MM.json` (save it as-is — the script reads `{"games":[...]}`).
3. Run `python scripts/analyze_chesscom.py <username> --input archives --from … --to …`.

In a networked environment (Claude Code, local shell) you can instead let the script
fetch directly — omit `--input`.

## Endpoints

1. **List a player's monthly archives**
   ```
   GET https://api.chess.com/pub/player/{username}/games/archives
   → { "archives": [ "https://api.chess.com/pub/player/{u}/games/2024/01", ... ] }
   ```
   Each URL is one month. Pick only the months overlapping the range you need.

2. **Fetch one month of games**
   ```
   GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
   → { "games": [ Game, ... ] }
   ```

3. **Player profile / current ratings** (optional)
   ```
   GET https://api.chess.com/pub/player/{username}
   GET https://api.chess.com/pub/player/{username}/stats
   ```

Do **not** download a player's whole history game-by-game for a broad question — that's
what the export is for. Fetch targeted months (e.g. the month of a reported slump).

## Game object (fields that matter)

```jsonc
{
  "url": "https://www.chess.com/game/live/123",
  "end_time": 1700000000,           // unix seconds → date/weekday
  "time_class": "blitz",            // bullet | blitz | rapid | daily
  "time_control": "180+2",
  "rated": true,
  "rules": "chess",
  "white": { "username": "...", "rating": 2890, "result": "win" },
  "black": { "username": "...", "rating": 2875, "result": "resigned" },
  "accuracies": { "white": 88.4, "black": 79.1 },  // present only if analyzed
  "pgn": "...[ECO \"B90\"] [ECOUrl \"https://www.chess.com/openings/Sicilian-Defense-Najdorf\"]..."
}
```

## Deriving fields (match ChessAnalytics' logic)

- **Which side is the player?** Compare `white.username` / `black.username` to the queried
  username (case-insensitive). `myData` = that side; `oppData` = the other.
- **Outcome** from `myData.result`:
  - `win` → **win**
  - draw codes → **draw**: `agreed`, `repetition`, `stalemate`, `insufficient`,
    `50move`, `timevsinsufficient`
  - anything else (`checkmated`, `resigned`, `timeout`, `abandoned`, …) → **loss**
- **Accuracy** = `accuracies[mySide]`, rounded; skip games without `accuracies`.
- **Opening**: parse `[ECO "X"]` and the `[ECOUrl ".../openings/<slug>"]` from the PGN.
  The slug (hyphens → spaces) is a human-readable opening name. ECO first letter → family:
  `A` Flank, `B` Semi-Open, `C` Open, `D` Closed, `E` Indian.
- **Date / weekday** from `end_time` (unix seconds × 1000). Week starts Monday in the app
  (`(getDay()+6) % 7`, Mon=0 … Sun=6).

## Aggregations to reproduce

Mirror the export so detail is comparable: result counts & win rate; performance by color;
accuracy buckets (`<50, 50-59, 60-69, 70-79, 80-89, 90+`); per-opening
wins/draws/losses/total/netScore/winRate; monthly trend; weekday median net score
(win=+1, draw=0, loss=-1). For *detail* questions also keep game-level rows (date,
opponent, opponent rating, color, opening, accuracy, result, url) so you can cite
specific games.
