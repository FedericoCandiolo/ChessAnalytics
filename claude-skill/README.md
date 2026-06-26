# ChessAnalytics Coach — Claude Skill

A Claude Skill that turns a player's Chess.com record into chess-coaching advice
(strengths, weaknesses, ranked recommendations) and can render a shareable report in the
**ChessAnalytics** visual style.

```
chess-analytics-coach/
├── SKILL.md                     # entry point (instructions + routing)
├── reference/
│   ├── export-schema.md         # the "Export for AI" JSON schema (paste path)
│   └── chesscom-api.md          # Chess.com endpoints + aggregation rules
└── scripts/
    ├── analyze_chesscom.py      # aggregate games (web-fetch+--input, or direct fetch)
    └── build_report.py          # render a styled report — HTML and/or PDF
```

## How it works

Two ways to get the data in (no copy-paste required for the first):

1. **Fetch from Chess.com (default).** Just name a player — *"analyze chess.com user
   `fede`"*, *"review my last 3 months of blitz"*. Because the skill's code sandbox has no
   network, **Claude** fetches the monthly archives with its web-fetch tool, saves them,
   and `analyze_chesscom.py --input` aggregates them in the sandbox (same logic as the
   ChessAnalytics dashboard).
2. **Paste a ChessAnalytics export.** If the user clicks **Export for AI** in the app and
   pastes the text, the skill analyzes that directly — useful offline or when web-fetch is
   blocked.

Then the skill replies with the analysis in the user's language. Reports are **on demand**:
it offers one but keeps chatting, and only renders it (HTML or PDF, via `build_report.py`)
once you confirm the analysis is complete.

> **Email:** sending email is not native to Claude.ai / Claude Desktop. If an email
> connector or MCP server is configured (common in Claude Desktop), the skill offers to
> send the report; otherwise it provides the file for the user to attach themselves.

## Installing on Claude.ai

Custom Skills require a plan with Skills + code execution enabled.

1. Zip the **inner** folder so `SKILL.md` is at the archive root:
   ```bash
   cd claude-skill
   zip -r chess-analytics-coach.zip chess-analytics-coach
   ```
   (In this repo, `npm run build:skill` does this and drops the zip in `public/downloads/`
   so the live site can offer it as a download.)
2. In Claude.ai → **Settings → Capabilities → Skills** (enable code execution if prompted).
3. **Upload skill** and select the zip.
4. Start a chat, name a Chess.com user (or paste an export), and ask away — Claude invokes
   the skill automatically from its `description`.

## Notes

- Both scripts use only the Python standard library (no `pip install`).
- `analyze_chesscom.py` direct-fetch mode needs network and a `User-Agent` (set
  automatically); the `--input` mode needs neither and is what runs in the Claude.ai
  sandbox.
- Aggregation mirrors the app's logic, so fetched numbers line up with the app's exports.
