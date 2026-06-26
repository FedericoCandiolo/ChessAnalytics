# ChessAnalytics Coach — Claude Skill

A Claude Skill that turns ChessAnalytics data into chess-coaching advice. It reads the
**"Export for AI"** report your users copy from the app, and can fetch the **Chess.com
public API** directly when deeper, game-level detail is needed.

```
chess-analytics-coach/
├── SKILL.md                     # entry point (instructions + routing)
├── reference/
│   ├── export-schema.md         # the "Export for AI" JSON schema
│   └── chesscom-api.md          # Chess.com endpoints + aggregation rules
└── scripts/
    └── analyze_chesscom.py      # fetch + aggregate from Chess.com (detail path)
```

## How users use it

1. In ChessAnalytics, set filters and click **Export for AI** → the report is copied to
   the clipboard.
2. In Claude, paste it and ask a question — *"What should I work on?"*, *"Why am I losing
   with Black?"*, *"Analyze my last 3 months."*
3. The skill analyzes the export and replies with strengths, weaknesses, and ranked
   recommendations, in the same language as the export.
4. If the question needs detail the export doesn't carry (specific lost games, per-game
   accuracy, openings beyond the top 20), the skill fetches those months from Chess.com.

Users can also skip the app entirely and just say *"analyze chess.com user `hikaru`"* —
the skill will fetch and aggregate directly.

## Installing on Claude.ai

Custom Skills require a plan with Skills + code execution enabled (Pro/Max/Team/Enterprise,
where available).

1. Zip the **inner** folder so `SKILL.md` is at the archive root:
   ```bash
   cd claude-skill
   zip -r chess-analytics-coach.zip chess-analytics-coach
   ```
2. In Claude.ai → **Settings → Capabilities → Skills** (enable code execution if prompted).
3. **Upload skill** and select `chess-analytics-coach.zip`.
4. Start a chat, paste an export (or name a Chess.com user), and ask away. Claude invokes
   the skill automatically based on its `description`.

> The skill description is what makes Claude pick it up — it triggers on pasted
> ChessAnalytics reports and on requests to analyze Chess.com performance.

## Notes

- The fetch script uses only the Python standard library (no `pip install`).
- The Chess.com API needs a `User-Agent` header (the script sets one). If the sandbox has
  no network, the skill falls back to fetching specific months via the host's web-fetch
  capability — see `reference/chesscom-api.md`.
- Aggregation in `analyze_chesscom.py` mirrors the app's logic so fetched numbers line up
  with the exported ones.
