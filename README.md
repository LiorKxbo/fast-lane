# Quick Lane

A single-file, fully static browser game — a *Jones in the Fast Lane*–style life-sim.
Race the virtual neighbour **Jones** to four life goals (Wealth, Happiness, Education, Career).

Two modes share one engine:

- **Adults** — English, LTR, the full strategy game: 60-hour weeks, monthly rent, loans,
  clothing wear, fluctuating prices, and you *can* lose to Jones.
- **Kids** — Hebrew, RTL, gentle and simplified: 24-hour days, no rent/loans/clothing,
  positive-only random events, Hebrew text-to-speech read-aloud, and **you cannot lose**
  (Jones is just a friendly pacer).

The whole game is one self-contained `index.html` — vanilla JS, no framework, no bundler,
no backend, no database. The only external dependency is Google Fonts (loaded via CDN).

---

## Play locally

It's a static file, so any of these work:

```bash
# 1) Just open it
#    open index.html in a browser

# 2) Or serve it (handy on some browsers' file:// restrictions)
node server.js          # then visit http://localhost:5050
```

The game opens with a **passcode screen — the code is `2706`** — then a chooser:
**Adults (English)** or **ילדים (Hebrew)**.

---

## QA harness

`qa.js` is the source of truth for balance and integrity. It extracts the game script
from `index.html`, runs it in a Node `vm` with a stubbed DOM, and asserts data integrity,
the profanity filter, unit tests, and ~250 greedy-AI simulations per mode × difficulty.

```bash
node qa.js                 # full run
SIMS=120 node qa.js        # fewer sims (faster, for iterating)
RUNS=3 node qa.js          # repeat the suite to confirm a stable pass
node --check <(…)          # qa.js also runs `node --check` on the extracted script
```

After **any** change to game logic, run `node qa.js` and keep it green.

> Note: difficulty goals follow the design spec; the Jones `jSpeed` values were
> re-tuned via `qa.js` against this build's economy so the race-quality targets pass
> (e.g. hard win-rate lands in the 25–82% band). If you change the economy, re-tune
> `jSpeed` and re-run the harness.

---

## ⚠️ Passcode security

The `2706` passcode is **client-side gating only**. The code is visible in the page
source (`const GATE_CODE = "2706"`) and provides **no real security** — it just keeps
casual visitors out. Anyone who views source can read it.

### Real protection — Caddy Basic Auth

For actual access control, put HTTP Basic Auth in front of the static files with Caddy.
Generate a hash for the password:

```bash
caddy hash-password --plaintext 2706
```

Then use a `Caddyfile` like this (replace the hash with the output above):

```caddyfile
:{$PORT} {
	root * .
	file_server
	basic_auth {
		player <PASTE_BCRYPT_HASH_HERE>
	}
}
```

This requires switching from the zero-config `Staticfile` approach to a custom Caddy
config (Railway can run a `Caddyfile`). Username is `player`; the password is whatever
you hashed. Unlike the in-page passcode, this is enforced server-side before any file
is served.

---

## Deploy to Railway (static, served by Caddy)

The empty **`Staticfile`** in the repo root triggers Railway/Railpack's static-site
detection, so the app is served by Caddy with **zero build config**. Railway provides
`$PORT` and HTTPS automatically.

1. Push this folder to a GitHub repo.
2. Railway → **New Project** → **Deploy from GitHub repo** → pick the repo.
3. **Generate Domain** (Settings → Networking).
4. Every push redeploys automatically.

No build step, no server code needed in production — `server.js` is dev-only and is
git-ignored.

---

## Repo layout

```
index.html      # the whole game (engine + UI, single file)
Staticfile      # empty -> Railway/Railpack static detection (Caddy)
qa.js           # Node QA harness (balance + integrity source of truth)
README.md       # this file
.gitignore
CLAUDE.md       # standing project context for Claude Code
server.js       # dev-only local static server (git-ignored)
```
