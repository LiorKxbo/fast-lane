# CLAUDE.md — Quick Lane

Project context for Claude Code. Read `BUILD_PROMPT.md` for the full spec.

## What this is
A single-file static browser game (`index.html`) — a *Jones in the Fast Lane*–style life-sim. Race the rival "Jones" to four goals (Wealth, Happiness, Education, Career). Two modes share one engine: **Adults** (English, LTR, full game) and **Kids** (Hebrew, RTL, simplified, read-aloud, cannot lose). Opens with passcode **2706**.

## Hard constraints
- ONE self-contained `index.html`. Vanilla JS, no framework, no bundler, no backend, no DB.
- No `localStorage`/`sessionStorage` (in-memory state only).
- External deps: Google Fonts only (Space Grotesk, DM Mono, Fredoka, Heebo).
- Mobile-first. Respect `prefers-reduced-motion`.

## Time model (don't break this)
- Adults: "Week" = 60 hours/turn; rent due every 4th week (monthly).
- Kids: "Day" = 24 hours/turn; no rent.
- Travel + actions cost hours. Game length is goal-driven (no fixed turn cap); Jones is the deadline.

## Balance (converged via simulation — keep QA green if you change it)
- Wage cap is load-bearing: `base*(1+0.25*rank+min(0.03*exp,0.45))`. Don't remove the cap.
- Jones: `jp += GOAL*(1/jonesTurns)*jSpeed*rand(0.8–1.2)`; finishes ~`jonesTurns/jSpeed` turns. Adults jonesTurns=18 (can lose); kids jonesTurns=30 (lose disabled).
- Difficulty/jSpeed values are in BUILD_PROMPT §5.

## Working rules
- After ANY change to game logic: run `node qa.js` and `node --check` on the extracted script. Don't declare done until both pass across several runs.
- `qa.js` is the source of truth for balance + integrity (see BUILD_PROMPT §10). Update its targets only with a clear reason.
- The map avatar must stand ABOVE building tiles (never overlap the building name label).
- Passcode is client-side only — say so in the README; offer Caddy Basic Auth for real protection.
- Deploy target: GitHub → Railway (static via empty `Staticfile`, served by Caddy). **Never `git push` or deploy without explicit confirmation in chat.**

## Repo layout (push-ready)
```
index.html      # the whole game
Staticfile      # empty -> Railway/Railpack static detection
qa.js           # Node QA harness (dev only; fine to .gitignore for deploy)
README.md       # deploy steps + password caveat
.gitignore
```

## Default names (character creator)
boy בארי · girl נטע · man Lior · woman Avigail. 4 diverse looks (skin tones) per choice. Name profanity filter with leetspeak de-mapping; don't over-block real names.
