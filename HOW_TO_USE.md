# How to move this into Claude Code

You have two ways to do it. Both are quick.

## Option A — Rebuild from the spec (recommended for a clean project)
1. Make a new folder and open it in Claude Code:
   ```bash
   mkdir quick-lane && cd quick-lane
   claude
   ```
2. Copy `CLAUDE.md` into the folder (gives Claude Code standing context every session).
3. Paste the entire contents of `BUILD_PROMPT.md` as your first message to Claude Code.
4. Let it build `index.html` + `qa.js`, then tell it: "run the QA loop until green." It should iterate until `node qa.js` and `node --check` pass.
5. When you're happy, ask it to prepare the Railway repo (`Staticfile`, `README.md`, `.gitignore`). Deploy only when you say so.

## Option B — Bring the working version with you (fastest)
If you already have the finished `index.html` (the `quick-lane/index.html` I built), just drop it into the new folder alongside `CLAUDE.md`, open Claude Code, and say:
> "Here's the finished game in index.html. Read CLAUDE.md. Write qa.js per the spec, run it, and confirm it's green. Then prepare the Railway repo."
This skips the rebuild and goes straight to QA + deploy prep.

## Files in this handoff
- `BUILD_PROMPT.md` — the full build prompt to paste into Claude Code.
- `CLAUDE.md` — standing project context; keep it in the repo root.
- (bring) `index.html` — the already-built game, if you want Option B.

## Notes
- Tell Claude Code explicitly: **do not git push or deploy without your confirmation.** (It's in CLAUDE.md too.)
- Passcode is **2706** and is client-side only — for real protection use the Caddy Basic Auth block described in the README it generates.
- Deploy is GitHub → Railway; the empty `Staticfile` makes Railway serve it statically with zero config.
