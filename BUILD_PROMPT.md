# Build prompt — "Quick Lane" (paste into Claude Code)

You are building **Quick Lane**, a single-file, fully static browser game — a *Jones in the Fast Lane*–style life-sim where the player races a virtual neighbor ("Jones") to four life goals. It must run as one self-contained `index.html` (no backend, no build step, no database, no external JS — only Google Fonts via CDN). Mobile-first. Target deploy: GitHub → Railway (static, served by Caddy).

Work iteratively: build, then write a Node QA harness, run it, fix until it's green. Do not consider the task done until the QA passes and `node --check` on the extracted script passes. Confirm before any `git push` or deploy.

---

## 1. Product overview

A passcode screen opens the game (code **2706**). Then a chooser: **Kids (Hebrew)** or **Adults (English)**. Each path: pick difficulty → create a character (gender, look, name) → play. The board is a top-down "city diorama" map with buildings you walk between; each move and action costs hours from a per-turn time budget. Reach all four goals (Wealth, Happiness, Education, Career) before Jones does.

Two fully separate modes share one engine:
- **Adults** — English, LTR, the full strategy game. Faithful to the original: weeks of 60 hours, monthly rent, loans, clothing wear, fluctuating prices, can lose to Jones.
- **Kids** — Hebrew, RTL, simplified and gentle: 24-hour days, no rent, no loans, no clothing wear, positive-only random events, **cannot lose**, plus Hebrew text-to-speech read-aloud.

---

## 2. Time model (this is important — get it exactly right)

Researched from the original *Jones in the Fast Lane* (Sierra, 1991): a turn = one **week**, each week = **60 "hours"** (time points) spent on moving + actions; **4 weeks = a month**, rent due monthly; consumables deplete ~1/week; game length is set by the goals, not a fixed turn count. Mirror that for adults. For kids, switch to an intuitive **24-hour day** (so labels say "יום"/day, not a nonsensical "50-hour day").

- **Adults:** unit = "Week" (`WK`), **60 hours/turn**, rent charged only on every 4th week.
- **Kids:** unit = "Day" (`יום`), **24 hours/turn**, no rent.
- Travel between buildings costs hours by distance (bigger divisor for kids so trips are cheaper). Each action costs hours too.

---

## 3. The map (11 locations, you travel through them)

Top-down board, square aspect, with a central hub ("Hot Tips" / notice board) and a ring road; spokes connect every building through the hub, so cross-town trips route **through** the center. A walking avatar animates from building to building; a pulsing "you are here" ring follows it. Day/night tint deepens as the turn's hours drain (adults only).

Locations (id → adult name / kid name):
`home` Rent-A-Room / הבית · `uni` University / בית הספר · `emp` Jobs Office / לוח עבודות · `bank` Bank / קופת חיסכון · `socket` Socket City / חנות צעצועים · `club` Black Hole / פארק שעשועים · `hock` Hock Shop / דוכן החלפות · `zmart` Z-Mart / סופרמרקט · `burger` Monolith / דוכן חטיפים · `factory` The Factory / חוות חיות · `tips` Hot Tips / לוח מודעות.

Visual: glowing neon streets (SVG with a blur filter, dark casing under a lit lane, dashed centre line), extruded 3D building tiles (gradient face, colored neon aura, solid side + ground shadow), faint city-grid ground texture, twinkling lights, vignette. Each building shows an emoji + its (localized) name. **The avatar must stand ABOVE the building tile** (offset up by ~36px) so it never overlaps the building's name label.

---

## 4. Core mechanics

**Four goals / gauges** (circular SVG meters): Wealth (net = cash + bank − loan), Happiness (0–100), Education (courses completed), Career (job level + promotion rank). Win = all four met. The win check fires the moment the player meets all four on their own turn (player completes before Jones advances that turn).

**Resources/state per game:** cash, bank, loan, happy, food (0–100), clothing tier (0–3) + wear, edu (course count), job index + experience + rank, house tier, week/day counter, hours left, map position, price multiplier, "read tips this turn" flag, owned resellable goods count, Jones progress object, over flag.

**Jobs** (employer-tied; you apply at Jobs Office, then walk to that workplace to work shifts):
Adults: Burger Cook (burger,lv1,wage70,edu0,cloth0) · Z-Mart Cashier (zmart,1,90,0,0) · Line Worker (factory,2,135,0,1) · Sales Clerk (socket,2,155,1,1) · Bank Teller (bank,3,215,2,2) · Factory Foreman (factory,3,245,2,2) · Store Manager (socket,4,310,3,2) · Loan Officer (bank,5,390,4,3) · Professor (uni,6,520,6,3).
Kids: מוכר/ת לימונדה (burger,1,45,0) · מטפל/ת בכלבים (factory,1,60,0) · ספרן/ית (uni,1,80,1) · מדען/ית (socket,2,120,2) · וטרינר/ית (factory,3,160,3) — gated by education only (no clothing).

**Wage:** `base * (1 + 0.25*rank + min(0.03*exp, 0.45))`. The `min(...,0.45)` cap is essential — without it late wages explode and the game becomes trivially short. A shift costs 6h (adult) / 5h (kid), earns the wage, +1 exp, small happiness/food cost.

**Promotions:** exp ≥4 → rank 1 ("Senior"), ≥9 → rank 2 ("Lead"); Career level = job.lv + rank. Show a 🎉 popup on promotion.

**Education:** University course costs money + 8h (adult) / 6h (kid), +1 edu. Higher jobs need more courses (and, adults only, higher clothing tier).

**Clothing (adults only):** tiers Casual/Business/Executive bought at Z-Mart; required for better jobs; wears down (~every 4 weeks a tier drops if not refreshed).

**Food/hunger:** decays each turn (28 adult / 12 kid); low food drains happiness. Eat cheap at Monolith or buy groceries at Z-Mart.

**Housing (adults):** Rent-A-Room (rent 180/mo, mood capped at 75), Apartment (380, cap 100, deposit 450), Condo (650, cap 100, +comfort, deposit 1300). The mood cap means you MUST upgrade housing to hit higher happiness goals. Kids: single free house, cap 100.

**Bank (adults):** deposit/withdraw, take/repay loans (loan interest 8%/wk), savings interest 4%/wk. Kids: storage only, no interest, no loans.

**Hock Shop:** sell owned goods for quick cash; buy used goods for cheaper happiness.

**Happiness buys:** appliances (Z-Mart), electronics (Socket City, biggest), night out (Black Hole), rest at home. Kids: toys, park, etc.

**Prices + Hot Tips (adults):** weekly price multiplier 0.85–1.20 (hidden); paying at Hot Tips reveals it AND gives a ~60% chance to dodge the next bad random event. Kids: prices fixed; Hot Tips just gives a small happiness boost.

**Random events** at end of turn (weighted deck): adults get good + bad (lottery, tax refund, work bonus, found wallet vs. tax bill, pickpocket, flu, broken appliance, repair bill). Kids get **good-only** events.

**Jones (the rival):** advances each turn toward the same four goals: `jp[stat] += GOAL[stat] * (1/jonesTurns) * jSpeed * rand(0.8–1.2)`. He "finishes" in roughly `jonesTurns / jSpeed` turns. Adults: `jonesTurns=18`, can lose to him. Kids: `jonesTurns=30`, **lose disabled** (he's a friendly pacer only). Show his overall % bar + four mini-bars.

---

## 5. Difficulty + Jones tuning (converged via simulation — use these)

```
DIFF_ADULT (time:60 each):
  easy:   goal {wealth:5000,  happy:75, edu:4, career:3}  jSpeed 1.9   cash 350
  normal: goal {wealth:9000,  happy:82, edu:6, career:4}  jSpeed 2.55  cash 200
  hard:   goal {wealth:15000, happy:88, edu:8, career:6}  jSpeed 2.6   cash 120
DIFF_KID (time:24 each):
  easy:   goal {wealth:500,  happy:60, edu:2, career:1}  jSpeed 0.18  cash 250
  normal: goal {wealth:800,  happy:70, edu:3, career:2}  jSpeed 0.24  cash 250
  hard:   goal {wealth:1200, happy:78, edu:4, career:3}  jSpeed 0.32  cash 200
```
(If you change the economy, re-tune jSpeed so the QA race-quality targets below pass.)

---

## 6. Character creator

After difficulty, a screen with: gender choice (Kids: ילד/ילדה · Adults: Man/Woman), **4 diverse looks** per choice (person emoji in 4 skin tones), and an editable name. Default names: boy **בארי**, girl **נטע**, man **Lior**, woman **Avigail**. The chosen look becomes the map avatar and shows in the HUD + end screen.

**Profanity filter** on the name: reject offensive names (English + Hebrew lists), and de-leet first (1→i, 0→o, 3→e, 4→a, 5→s, 7→t, @→a, $→s) so "b1tch" is caught; then strip to letters only and substring-match a blocklist. Don't over-block real names (e.g. don't blanket-ban "ass" — it breaks Cassie/Assaf). Empty name → default. Strip `< > &` from accepted names.

---

## 7. Localization & accessibility

- Full Hebrew strings for kid mode (RTL via `body.dir`), English for adults. All user-facing text comes from a per-language `STR` table + per-mode data (node names, job titles, panels, events, hints).
- **Kids read-aloud:** Web Speech API (`speechSynthesis`, `he-IL` voice). On by default in kid mode with a 🔊/🔇 toggle; auto-reads the message bar; a small 🔊 button on each location reads its description; reads tutorial hints. Strip emoji before speaking. Degrade silently if no voice.
- First-run coachmarks (3 tips), shown once per page session.
- Currency: `$` (adults) / 🪙 (kids). Respect `prefers-reduced-motion`.

---

## 8. Passcode gate

Game opens with a passcode screen requiring **2706** before the chooser. Implement as `const GATE_CODE="2706"`. **Be explicit in the README that this is client-side gating only — the code is visible in source and is not real security.** Provide a Caddy Basic Auth alternative for real protection (username `player`, bcrypt hash of the code; generate with `caddy hash-password`).

---

## 9. Tech constraints

- One `index.html`. Vanilla JS, no frameworks, no bundler.
- **No `localStorage`/`sessionStorage`** if you want it to also preview inside Claude artifacts; in-memory state only (fine to restart on refresh).
- Google Fonts via CDN: Space Grotesk + DM Mono (adults), Fredoka + Heebo (kids/Hebrew).
- Clean, themed UI: dark "dusk city" for adults; bright, rounded, sunny theme for kids (`body.kid` overrides).

---

## 10. QA harness (build this and keep it green)

Create `qa.js` (Node) that: reads `index.html`, extracts the `<script>`, appends an epilogue exposing internals, runs it in a `vm` context with a stubbed DOM (`getElementById` returns stub elements with `classList`/`style`/`textContent`/`innerHTML`/`appendChild`/`querySelectorAll`/`onclick`; `window` without `speechSynthesis` so TTS no-ops). Then assert:

**Data integrity:** every job's employer is a real node; every node has a panel and vice-versa; 4 looks per gender; default names pass the filter; every difficulty's career goal is reachable (some job with `lv+2 >= goal.career` and cloth ≤ max); adult time=60, kid time=24, kid rent=0, adult rent>0.

**Profanity:** clean names accepted (Lior, Avigail, בארי, נטע, Sarah, Cassie, Assaf, empty); offensive blocked incl. leetspeak (`b1tch?`, `a$$hole`, `n1gger`, `p0rn`, and Hebrew curses).

**Unit tests:** travelCost(same)=0, distinct≥1, symmetric, kid≤adult; adult rent charged only on week%4===0 and kids never; clampHappy respects house cap; adult bank earns interest, kid bank doesn't; careerLv = job.lv + rank.

**Simulations:** ~250 greedy-AI playthroughs per mode×difficulty. The AI each turn: eat if hungry → study toward edu goal → (adult) buy clothes for the next job → apply to best eligible job → (adult) upgrade house if mood capped below goal → buy mood once wealth has a buffer → work remaining hours. Track win/loss/timeout, weeks-to-win, and **Jones%-at-win** (race closeness). Assert: **no exceptions**; kids never lose and stay ≥85% winnable; and the adult race-quality targets:

```
adult/easy:   win 90–100%, loss 0–15%,  weeks≥4, Jones@win ≥20%
adult/normal: win 70–100%, loss 0–40%,  weeks≥5, Jones@win ≥55%
adult/hard:   win 25–82%,  loss 18–80%, weeks≥6, Jones@win ≥70%
```
Run it several times (fresh randomness) to confirm the pass is stable, not a lucky seed. Also run `node --check` on the extracted script.

---

## 11. Deploy (do NOT run without my confirmation)

Prepare a clean repo: `index.html`, an empty `Staticfile` (triggers Railway/Railpack static detection → served by Caddy, no build), `.gitignore`, and a `README.md` documenting the deploy and the password caveat. Deploy flow: push to GitHub → Railway → New Project → Deploy from GitHub repo → Generate Domain. Railway handles `$PORT` + HTTPS. Every push redeploys.

---

## Acceptance criteria

1. `node --check` on the extracted script passes.
2. `node qa.js` passes all checks across several runs (no exceptions; balance targets met; kids unloseable).
3. Manual smoke test: passcode 2706 unlocks; both modes playable end-to-end; avatar never overlaps building labels; Hebrew TTS toggles; a game is winnable and Jones can win on hard.
4. Repo is push-ready for Railway (static, no build).

Build it, run the QA loop until green, then show me the result and wait for my go-ahead before any deploy.
