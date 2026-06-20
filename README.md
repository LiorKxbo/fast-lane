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

## 🔐 Access — two password layers (both `2706`)

This build is protected by **two** layers, both keyed to `2706`:

1. **Server-side HTTP Basic Auth (Caddy).** Enforced before any file is served —
   nothing loads without it. Username `player`, password `2706`, stored only as a
   bcrypt hash in `Caddyfile` (never plaintext). This is the real access control.
2. **In-game passcode screen.** After Basic Auth, `index.html` shows the `2706`
   keypad gate (`const GATE_CODE = "2706"`). This layer is client-side only — the
   code is visible in page source — so it's convenience, not security.

### Changing the password

```bash
caddy hash-password --plaintext <new-code>   # paste the hash into Caddyfile (layer 1)
# then update GATE_CODE in index.html to the same code (layer 2)
```

---

## Deploy to Railway (Docker + Caddy)

Because of the server-side Basic Auth, the app deploys as a tiny **Caddy container**
(`Dockerfile` + `Caddyfile`) instead of zero-config static hosting — Railway uses the
`Dockerfile` automatically when present. Railway provides `$PORT` and terminates HTTPS
at its edge; Caddy serves plain HTTP on `$PORT` behind it.

1. Push this folder to a GitHub repo.
2. Railway → **New Project** → **Deploy from GitHub repo** → pick the repo.
3. **Generate Domain** (Settings → Networking).
4. Every push redeploys automatically.

The image contains only Caddy + `index.html` (see `.dockerignore`), so the QA harness
and build docs are never served publicly. `server.js` is dev-only and git-ignored.

### Test the container locally (optional, needs Docker)

```bash
docker build -t quick-lane .
docker run --rm -e PORT=8080 -p 8080:8080 quick-lane
# http://localhost:8080  ->  Basic Auth (player / 2706)  ->  in-game gate (2706)
```

---

## Repo layout

```
index.html      # the whole game (engine + UI, single file)
Dockerfile      # builds the Caddy container Railway deploys
Caddyfile       # Caddy config: Basic Auth (player/2706) + static file server
.dockerignore   # keeps only index.html + Caddyfile in the image
qa.js           # Node QA harness (balance + integrity source of truth)
README.md       # this file
.gitignore
CLAUDE.md       # standing project context for Claude Code
server.js       # dev-only local static server (git-ignored)
```
