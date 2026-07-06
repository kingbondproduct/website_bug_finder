---
name: run-website-bug-finder
description: Build, launch, and drive the Ather Website Bug Finder platform locally — start the Fastify API + React dashboard, trigger a crawl, and screenshot the dashboard. Use when asked to run, start, build, test, smoke-test, or screenshot the bug-finder / crawler app.
---

# Run the Ather Website Bug Finder

A crawler + bug-detection platform: a Fastify API (`:3001`) hosts an in-process
Playwright crawl worker and serves a React dashboard (`:5173`). It crawls the
Ather site across desktop + mobile viewports and classifies findings into
Server Error / Visual Bug / Broken Link / Copy Issue / Performance Bottleneck.

**The app is driven by [`driver.mjs`](.claude/skills/run-website-bug-finder/driver.mjs)** —
a Playwright harness that opens the dashboard, clicks **Trigger Manual Crawl**,
waits for the crawl to finish, asserts bugs + screenshots were produced, and
captures a full-page dashboard screenshot. It also has an API-only mode
(`--no-ui`) for headless smoke tests.

All paths below are relative to the repo root (the unit). The driver lives at
`.claude/skills/run-website-bug-finder/driver.mjs`.

## Prerequisites

- Node.js 20+ (verified on v22.16.0) and npm 10+.
- Verified on macOS (darwin/arm64). On Linux, additionally run
  `npx playwright install-deps chromium` for Chromium's shared libraries
  (not needed on macOS).

## Build (one-time)

```bash
npm install                      # installs workspaces; postinstall runs `prisma generate`
npx playwright install chromium  # ~93MB Chromium download — separate from npm install
npm run db:migrate               # creates SQLite DB at data/dev.db (says "Already in sync" if it exists)
```

Sanity-check the categorization engine:

```bash
npm test                         # vitest — 6 tests pass
```

## Run (agent path — the driver)

Start the API and dashboard as **two separate, non-watch processes**, then run
the driver. Use `npm start` (plain `tsx`) for the API, NOT `npm run dev` — see
Gotchas for why watch mode breaks crawls.

```bash
# 1. API (stable, no file-watch) on :3001
npm start > /tmp/bugfinder-api.log 2>&1 &

# 2. Dashboard on :5173
npm run dev:web > /tmp/bugfinder-web.log 2>&1 &

# 3. Wait until both answer, then drive
until curl -sf http://localhost:3001/api/health >/dev/null && \
      curl -sf http://localhost:5173/ >/dev/null; do sleep 1; done

node .claude/skills/run-website-bug-finder/driver.mjs \
  --mode single --url https://www.atherenergy.com/contact \
  --out data/driver-dashboard.png
```

Expected tail:

```
[driver] triggered job cmr91j35t0000y36o18fi18ao
[driver] job cmr91j35 status=completed pages=1 bugs=4
[driver] dashboard screenshot -> data/driver-dashboard.png
[driver] pages with desktop+mobile screenshots: 1/1
[driver] OK ✅
```

**Screenshots land at:**
- Dashboard: `data/driver-dashboard.png` (or `--out`).
- Per-page crawl screenshots: `data/screenshots/<jobId>/<pageId>-{desktop,mobile}.png`.

### Driver options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--mode single\|site` | `single` | single URL (depth 0) vs seeded site-wide crawl |
| `--url <url>` | `…/contact` | target for single mode |
| `--max-pages <n>` / `--max-depth <n>` | 8 / 1 | site-mode caps (API-only path) |
| `--no-ui` | off | skip the browser; trigger + poll via API only (no dashboard needed) |
| `--out <path>` | `data/driver-dashboard.png` | dashboard screenshot path |
| `--timeout <ms>` | 180000 | overall job wait |

```bash
# API-only smoke (no dashboard server required):
node .claude/skills/run-website-bug-finder/driver.mjs --no-ui --mode single --url https://www.atherenergy.com/faq

# Site-wide recursive crawl, small cap (verified: 5 pages → 23 bugs):
node .claude/skills/run-website-bug-finder/driver.mjs --no-ui --mode site --max-pages 5 --max-depth 1 --timeout 240000
```

## Direct API calls (no driver)

```bash
curl -s http://localhost:3001/api/health                       # {"ok":true}
curl -s http://localhost:3001/api/seed-urls                    # 26 Ather seed URLs
JOB=$(curl -s -X POST http://localhost:3001/api/crawls \
  -H 'Content-Type: application/json' \
  -d '{"mode":"single","url":"https://www.atherenergy.com/contact"}' | \
  node -pe 'JSON.parse(require("fs").readFileSync(0)).jobId')
curl -s http://localhost:3001/api/crawls/$JOB                  # job status + counters
curl -s "http://localhost:3001/api/crawls/$JOB/bugs?category=Server%20Error"  # filtered bug matrix
```

## Run (human path)

`npm run dev` starts API + dashboard together via `concurrently` (API in
`tsx watch`). Open http://localhost:5173 and click **Trigger Manual Crawl**.
Fine for interactive dev; **do not use it for automated driving** (watch mode —
see Gotchas). Stop with Ctrl-C.

## Gotchas (hard-won)

- **Never drive with `npm run dev` / `dev:api` — they use `tsx watch`.** A file
  save (including a linter/formatter touching a file) restarts the API
  mid-crawl, which kills the headless browser and aborts the job. Worse, the
  watch supervisor process **survives the shell that launched it** and keeps
  re-binding, so a second server can end up sharing the same SQLite DB and
  producing phantom duplicate jobs. Use `npm start` (plain `tsx`, no watch) for
  anything scripted.
- **Killing by port isn't enough for watch mode.** `lsof -ti tcp:3001 | xargs kill`
  leaves the `tsx watch` supervisor alive (it just re-spawns its child). Kill by
  process args instead:
  ```bash
  ps aux | grep -E 'apps/api/src/server|@bugfinder/web|tsx watch' | grep -v grep | awk '{print $2}' | xargs kill -9
  ```
- **Chromium is a separate install.** `npm install` does NOT fetch it; you must
  run `npx playwright install chromium` or launches fail with "Executable doesn't exist".
- **Single vs site mode differ a lot.** `single` = one page, depth 0, ~10s.
  `site` = 26 seeds + recursion, minutes — always pass `--max-pages` for quick runs.
- **DB path is repo-root-relative via prisma/.** `.env` sets
  `DATABASE_URL="file:../data/dev.db"`, resolved relative to `prisma/schema.prisma`
  → `data/dev.db` at the repo root. `db:migrate` printing "Already in sync" is
  normal on a repeat run.
- **Mode-toggle selectors collide with crawl history.** The sidebar history lists
  each job's mode ("Single URL", "Site-wide"), so a Playwright
  `getByRole('button', { name: 'Single URL' })` matches multiple elements — the
  driver uses `{ exact: true }`. Keep that if you extend it.
- **A clean slate helps when debugging.** `rm -f data/dev.db* && npm run db:migrate`
  resets crawl history; `rm -rf data/screenshots/*` clears old shots.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Driver `FAIL: API never became healthy` | API isn't up on :3001. Check `/tmp/bugfinder-api.log`; ensure `npm start` is running. |
| `browserType.launch: Executable doesn't exist` | Run `npx playwright install chromium`. |
| Duplicate/phantom jobs, crawls dying at "running" | A stale `tsx watch` server is still alive. Kill by args (see Gotchas) and relaunch with `npm start`. |
| Screenshot URL returns 404 while a crawl is mid-write | Transient — the file is still being written. Re-request after the job reaches `completed`. |
| `strict mode violation … resolved to N elements` in a custom Playwright step | Use `{ exact: true }` or a more specific locator; history buttons share label text. |
