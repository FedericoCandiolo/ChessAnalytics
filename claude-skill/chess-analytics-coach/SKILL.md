---
name: chess-analytics-coach
description: Analyze a chess player's Chess.com performance and give coaching recommendations. Use when the user asks to analyze their or someone's chess games, names a Chess.com username to review, wants insights on openings / time controls / accuracy / win rate, asks for chess improvement advice, or pastes a ChessAnalytics "Export for AI" report. By default it fetches the player's games from the public Chess.com API; it can also read a pasted ChessAnalytics export.
---

# Chess Analytics Coach

Turn a player's Chess.com record into clear, actionable coaching advice — strengths,
weaknesses, and ranked recommendations.

There is **no ChessAnalytics API to call** — ChessAnalytics is a static dashboard. Data
comes from one of two sources below. Pick the first that applies.

## Data source A — fetch from Chess.com (default)

Use this whenever the user gives a username (e.g. *"analyze chess.com user fede"*,
*"review my blitz games"*). The Chess.com public API is JSON and needs no key.

The script that aggregates the games runs in a **sandbox without network access**, so
**you (Claude) fetch the data with your web-fetch tool**, save it, and let the script
crunch it. Steps:

1. **Pick the window.** Default to the **last ~3 months**. Honor anything the user
   specifies (date range, `time_class`, color, rated-only).
2. **Get the archive index** — web-fetch:
   ```
   https://api.chess.com/pub/player/<username>/games/archives
   ```
   It returns `{ "archives": [ ".../games/YYYY/MM", ... ] }`. Keep only the months that
   overlap your window.
3. **Fetch each needed month** — web-fetch each selected archive URL and **save the raw
   JSON** to a file, e.g. `archives/2024_11.json`. Don't trim it; save the response as-is.
4. **Aggregate in the sandbox** (no network used here):
   ```
   python scripts/analyze_chesscom.py <username> --input archives \
       --from YYYY-MM-DD --to YYYY-MM-DD [--time-class blitz] [--color black] [--detail]
   ```
   It prints a JSON stats object — the same aggregation ChessAnalytics itself uses.
5. Coach from that JSON (Sections "Analysis" + "Output").

If your environment *does* have direct network (e.g. Claude Code), you can skip the
manual fetch and let the script pull everything: `python scripts/analyze_chesscom.py
<username> --from … --to …`.

If web-fetch is blocked by a domain allowlist, say so and offer source B instead.

## Data source B — a pasted ChessAnalytics export

If the user pastes a ChessAnalytics report (text with `DATA:` / `DATOS:` followed by a
JSON block), just parse and analyze that JSON directly — no fetching. Full field schema:
[reference/export-schema.md](reference/export-schema.md).

This is the right path when the user prefers not to share a username, wants exactly the
slice they filtered in the app, or web-fetch is unavailable.

## Reading the data (both sources)

Endpoints, game-object fields, and the result/opening/weekday derivation rules are in
[reference/chesscom-api.md](reference/chesscom-api.md). Gotchas common to both:

- ELO is **per time class**, not one number.
- Opening `netScore` = wins − losses (practical result, not win rate).
- Weekday `medianNetScore` ∈ [-1, +1]: +1 all wins, -1 all losses, 0 balanced.
- Accuracy is only present for analyzed games, so accuracy counts can sum to fewer than
  the total games.

## Analysis methodology

Produce a coach's read, not a data dump. Apply these lenses:

- **Level & trajectory** — ELO per main time class, overall win rate, and the
  `monthlyTrend` direction. ~50% win rate ≈ a stable ladder; consistently higher = climbing.
- **Color imbalance** — a White-vs-Black win-rate gap >8–10 pts points to a weak
  repertoire on the worse side. Name the side; recommend study there.
- **Opening repertoire** — separate *mains* (high `games`) from *leaks* (decent volume,
  say ≥8–10 games, but low `winRate` or negative `netScore`). Leaks are the highest-ROI
  study targets. Praise the strongest mains.
- **Accuracy profile** — a heavy `<50` / `50-59` tail = blunders/calculation → tactics
  training, and slower time controls if they mostly play bullet. A healthy `80-89`/`90+`
  mass with poor results → strategy/endgames, not tactics.
- **Tilt & fatigue** — weekdays with strongly negative `medianNetScore` and high
  `gamesPlayed` suggest session-length or emotional-control issues.

## Output

Respond in the **user's language** (Spanish request/export → Spanish). Structure:

1. **Summary** — 2–3 sentences: level, primary time control, win rate, trend.
2. **Top 3 strengths** — concrete, each tied to a number.
3. **Top 3 weaknesses** — concrete, each tied to a number.
4. **3–5 recommendations** — specific and actionable (which opening to study, what
   training, which time-control change), ordered by expected impact.
5. *(optional)* **Deep dive** — if you ran `--detail`, surface the specific lost games /
   patterns.

Cite the numbers you used ("47% with Black across 112 games"). Never invent stats; if
something needed is missing, fetch it or say so.

## Generate a shareable report — ON DEMAND ONLY

**Do not auto-generate a report.** The user wants to chat, ask follow-ups, and dig deeper
across multiple turns first. Generating a file after the first analysis interrupts that.

Instead:

1. **Offer early, build late.** Once you've given the first analysis, mention *once* that a
   downloadable report is available in **HTML or PDF** whenever they're ready — then keep
   analyzing / answering. Don't ask again every turn.
2. **Only build the report when the user clearly approves** the analysis is complete or
   explicitly asks for it (e.g. "make the report", "I'm done, export it", "give me the
   PDF"). If it's ambiguous, ask which format rather than assuming.
3. **Follow the brand style guide — [reference/report-style.md](reference/report-style.md).**
   For any chess-related report this is **mandatory**: it specifies the bundled
   ChessAnalytics font (Inter) and logo to embed, the color tokens, the layout, and the
   print/margin rules. You compose the report (guided improvisation — tailor the layout to
   the conversation), but stay within those brand rules. **Only deviate from the brand look
   if the user explicitly asks for something different and you've confirmed it first.**
4. Two ways to produce it (both embed the same brand assets and print rules):
   - **Compose the HTML yourself** (preferred for a tailored report): read
     `assets/brand.css` and inline it; embed the logo from `assets/logo-dark.txt`; apply
     the print rules from the style guide; render with weasyprint to PDF and also save the
     HTML. Use the numbers already discussed — don't recompute or invent.
   - **Run the script** for a fast, guaranteed-consistent output:
     ```
     python scripts/build_report.py --input report.json --format both
     ```
     (schema at the top of `build_report.py`; it embeds the same font/logo/margins).
5. Key brand rules (full detail in the style guide):
   - **Default to HTML.** Only produce a PDF if the user explicitly asks for one.
   - **Embed the logo as an `<img>`** (data URI from `assets/logo-dark.txt`) — never render
     the brand as plain text. Embed **Inter** from `assets/brand.css`. The reliable way is
     the token-replace pattern in the style guide (you can't hand-type the base64).
   - Header is the **only** full-bleed element; **enforce page margins everywhere else**
     (`@page { margin: 15mm }`) and `break-inside: avoid` on every chart/section so nothing
     splits across pages.
   - Win = green, draw = amber, loss = red; respond in the user's language.
6. Give the user the resulting file(s) to download.

## Emailing the report

Sending email is **not** a built-in capability of Claude.ai or Claude Desktop, so do not
promise it unconditionally. Handle it like this:

- **If an email tool/connector is available** in the session (e.g. a Gmail connector or an
  email MCP server — common in Claude Desktop with MCP configured), offer to send the
  report file to an address the user provides, and use that tool.
- **Otherwise**, say email isn't available here and fall back: provide the report file
  (HTML or PDF) for them to attach and send themselves. Optionally draft the email subject
  and body text they can copy.

Never attempt to send mail straight from the sandbox (SMTP) — outbound network there is
blocked; it will fail.
