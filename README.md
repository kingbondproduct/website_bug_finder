# 🛵 Ather Website Bug Finder

> An automated **+** manual QA platform that crawls the Ather Energy website across
> **Desktop** and **Mobile** viewports, then classifies every problem it finds into a
> strict, review-ready bug taxonomy.

<p align="center">
  <em>Server Error &nbsp;·&nbsp; Visual Bug &nbsp;·&nbsp; Broken Link &nbsp;·&nbsp; Copy Issue &nbsp;·&nbsp; Performance Bottleneck</em>
</p>

---

## Table of contents

1. [What it does](#-what-it-does)
2. [The bug taxonomy (definitions)](#-the-bug-taxonomy)
3. [Tech stack](#-tech-stack)
4. [Architecture](#-architecture)
5. [Quick start](#-quick-start)
6. [End-to-end user flow](#-end-to-end-user-flow)
7. [End-to-end technical flow](#-end-to-end-technical-flow)
8. [Configuration](#-configuration)
9. [API reference](#-api-reference)
10. [Testing & driving the app](#-testing--driving-the-app)
11. [Publish to GitHub Pages](#-publish-to-github-pages-github-only)
12. [Project layout](#-project-layout)
13. [Further docs](#-further-docs)

---

## 🎯 What it does

Point it at the Ather site (or a single URL) and it will, per page and per viewport:

- 🔗 **Audit links & network** — flag `404` / `5xx` resources, broken redirects, and failed XHR/Fetch calls.
- 🐞 **Capture runtime errors** — uncaught JS exceptions and `console.error` messages during load.
- 🖼️ **Validate visuals & assets** — detect broken images (`naturalWidth === 0` or a non-`200` response) and save full-page screenshots for **Desktop (1920×1080)** and **Mobile (iPhone 12 Pro, 390×844)**.
- ✍️ **Audit content & copy** — catch placeholder/leaked text (`Lorem Ipsum`, `undefined`, `NaN`, `{{variable}}`, `[object Object]`, …) plus an offline spell-check pass.
- ⚡ **Measure performance** — record Navigation-Timing load and flag pages over a threshold.

Every finding is then **categorized and severity-scored** by a single classification engine
([`apps/api/src/crawler/categorize.ts`](apps/api/src/crawler/categorize.ts)) and surfaced in a
searchable, filterable **bug matrix** in the dashboard.

---

## 🏷️ The bug taxonomy

Every issue is tagged into **exactly one** of five categories. These definitions are the
contract between the crawler, the dashboard, and QA triage — the full mapping of raw signals
→ category → severity lives in [`docs/BUG_TAXONOMY.md`](docs/BUG_TAXONOMY.md).

| Category | Definition | What triggers it | Why it matters | Default severity |
| --- | --- | --- | --- | --- |
| 🔴 **Server Error** | The page or its runtime **failed to execute correctly** — a server-side failure or a client-side JavaScript crash. | HTTP `5xx`, failed XHR/Fetch, uncaught JS exceptions, `console.error`. | Broken functionality, blank sections, lost conversions. | Critical → Medium |
| 🟣 **Visual Bug** | Content **rendered incorrectly or is missing** even though the page loaded. | Broken images (`naturalWidth === 0` or asset returned non-`200`). | Looks unprofessional, erodes brand trust, hides product imagery. | Medium |
| 🟠 **Broken Link** | A destination or resource is **unreachable or misrouted**. | Page `404`, `4xx` sub-resources, broken redirect chains. | Dead ends, SEO penalties, users can't reach key pages. | High → Medium |
| 🔵 **Copy Issue** | The **text content is wrong** — unfinished, templated, or misspelled. | Placeholder/leaked template strings; spelling mistakes. | Signals an unfinished page; damages credibility and clarity. | High → Low |
| 🟡 **Performance Bottleneck** | The page is **technically correct but too slow**. | Load time exceeds the configured threshold (default 4s). | Higher bounce rates, poor mobile experience, weaker SEO. | Medium |

> **Severity scale:** `Critical` (breaks core function) → `High` → `Medium` → `Low` (cosmetic).
> Precise per-signal severities are defined in the taxonomy doc.

---

## 🧰 Tech stack

| Layer | Choice |
| --- | --- |
| Backend | Node.js + TypeScript, **Fastify** |
| Crawler | **Playwright** (Chromium, multi-viewport) |
| Queue | In-process **`p-queue`** (no Redis) — swappable for BullMQ later |
| Database | **SQLite** via **Prisma** |
| Frontend | **Vite + React + TypeScript + Tailwind** |
| Realtime | **Server-Sent Events (SSE)** |

---

## 🏗️ Architecture

```
   React SPA ──REST + SSE──▶ Fastify API ──enqueue──▶ p-queue worker ──▶ Playwright
     (:5173)                    (:3001)                                  (desktop + mobile)
                                   │                                            │
                                   ▼                                            ▼
                    SQLite (Prisma):  CrawlJobs · PagesDiscovered · BugsFound
```

The API process also hosts the crawl worker. Screenshots are written to
`data/screenshots/<jobId>/` and served under `/screenshots`. Live progress is streamed to the
dashboard over SSE.

---

## 🚀 Quick start

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Install the Chromium build Playwright drives (~93MB, separate from npm)
npx playwright install chromium

# 3. Create the SQLite database + tables
npm run db:migrate

# 4. Run the API (:3001) + dashboard (:5173) together
npm run dev
```

Then open **http://localhost:5173**.

> ℹ️ `npm run dev` runs the API under `tsx watch`. Editing a source file **restarts the API and
> aborts any in-progress crawl.** For an uninterrupted long crawl, run the API without watch:
> `npm start` (API) + `npm run dev:web` (dashboard) in separate terminals.

---

## 🧭 End-to-end user flow

From opening the platform to reading the results — what a QA engineer actually does.

```
 ①  Open dashboard            ②  Choose scope            ③  Trigger
 ┌───────────────────┐        ┌───────────────────┐      ┌───────────────────┐
 │ localhost:5173    │  ───▶  │ ◉ Single URL      │ ───▶ │  [Trigger Manual  │
 │ (Bug Finder home) │        │   ↳ paste a URL   │      │      Crawl]  ⏵     │
 │                   │        │ ○ Site-wide (26)  │      │                   │
 └───────────────────┘        │   ↳ depth / pages │      └───────────────────┘
                              └───────────────────┘                │
                                                                    ▼
 ⑥  Review & filter          ⑤  See it complete         ④  Watch live progress
 ┌───────────────────┐        ┌───────────────────┐      ┌───────────────────┐
 │ Bug Matrix        │  ◀───  │ status: completed │ ◀─── │ discovered / crawl │
 │ filter · search   │        │ 5 pages · 23 bugs │      │ / bugs  (live SSE) │
 │ evidence · shots  │        │                   │      │ ▓▓▓▓▓░░░░  running  │
 └───────────────────┘        └───────────────────┘      └───────────────────┘
```

**Step by step:**

1. **Open the platform** — go to **http://localhost:5173**. You land on the dashboard with the
   **Trigger Crawl** panel (left) and a results area (right).
2. **Choose what to audit** using the mode toggle:
   - **Single URL** — paste *any* page into the **Target URL** field
     (e.g. `https://www.atherenergy.com/rizta` or a custom staging URL). Audits that one page
     (depth 0). Fast (~10s) — ideal for spot checks and PR verification.
   - **Site-wide (26 seeds)** — audits the 26 canonical Ather pages, then recursively follows
     in-domain links. Set **Max depth** (how far to follow links) and **Max pages** (a safety cap).
3. **Click “Trigger Manual Crawl.”** The job is created and starts immediately; it also appears in
   **Crawl History** (left) so you can revisit it later.
4. **Watch live progress.** A progress bar and live counters — **Discovered · Crawled · Bugs** —
   update in real time (via SSE) as each page is audited across desktop **and** mobile.
5. **Wait for completion.** The status pill flips to **completed** (or **failed**), with final counts.
6. **Review results in the Bug Matrix:**
   - **Filter** by category (Server Error / Visual Bug / Broken Link / Copy Issue / Performance)
     and by severity; **search** across URL / message / type.
   - Read each bug's **message + evidence** (failing URL, status code, selector, snippet, timing…).
   - Open the per-page **Desktop + Mobile screenshots** to see the issue in context.
7. **Iterate** — fix, then re-run a Single-URL crawl on the same page to confirm it's clean, or
   re-open any past run from **Crawl History**.

---

## 🔄 End-to-end technical flow

What happens under the hood between clicking the button and seeing results. File references are
clickable so you can follow the path in code.

```
 Browser (React SPA :5173)                Fastify API + worker (:3001)            SQLite (Prisma)
 ─────────────────────────                ────────────────────────────           ───────────────
 TriggerCrawlPanel
   │ POST /api/crawls {mode,url,…}
   ├───────────────────────────────────▶  routes/crawls.ts
   │                                          │ validate + create job
   │                                          ├──────────────────────────────────▶ CrawlJob (queued)
   │           201 {jobId}                     │ enqueueCrawl(jobId)  [p-queue]
   │ ◀─────────────────────────────────────  │
   │                                          ▼
 JobProgress                               crawler/crawl.ts  (runCrawlJob)
   │ GET /api/crawls/:id/stream (SSE)          │ status → running                ─▶ CrawlJob (running)
   ├───────────────────────────────────▶      │ launch Chromium: desktop+mobile   (browser.ts)
   │                                          │ BFS from 26 seeds / single URL
   │                                          │  ┌─ per page ──────────────────┐
   │                                          │  │ create PageDiscovered row  ─┼─▶ PageDiscovered
   │                                          │  │ auditViewport(desktop)      │
   │                                          │  │  · linkAudit  · consoleAudit│
   │                                          │  │  · imageAudit · contentAudit│
   │                                          │  │  · performanceAudit         │
   │                                          │  │  · screenshot (D + M)       │
   │                                          │  │ auditViewport(mobile)       │
   │                                          │  │ mergeFindings → categorize()│
   │   event: progress {discovered,           │  │ persist bugs ──────────────┼─▶ BugFound[]
   │   crawled, bugs}  (per page)             │  │ update counters + emit ─────┤
   │ ◀───────────────────────────────────────┤  │ recurse in-domain links     │
   │                                          │  └─────────────────────────────┘
   │   event: done                            │ onIdle → status completed       ─▶ CrawlJob (completed)
   │ ◀───────────────────────────────────────┘
 BugMatrix
   │ GET /api/crawls/:id/bugs?category=&severity=&search=
   ├───────────────────────────────────▶  routes/crawls.ts → query BugFound  ◀── (filtered read)
   │   [bug rows + evidence]                   │
   │ ◀─────────────────────────────────────── │
   │ <img src="/screenshots/<jobId>/…">  ───▶  @fastify/static  →  data/screenshots/…
```

**Narrated:**

1. **Trigger.** The SPA ([`TriggerCrawlPanel.tsx`](apps/web/src/components/TriggerCrawlPanel.tsx))
   calls `POST /api/crawls`. The route ([`routes/crawls.ts`](apps/api/src/routes/crawls.ts))
   validates input, writes a **`CrawlJob`** (status `queued`) via Prisma, enqueues it, and returns `{ jobId }`.
2. **Queue → worker.** The in-process **`p-queue`** ([`queue/index.ts`](apps/api/src/queue/index.ts))
   runs [`runCrawlJob`](apps/api/src/crawler/crawl.ts), which flips the job to `running` and launches a
   headless Chromium with **desktop + mobile** contexts ([`browser.ts`](apps/api/src/crawler/browser.ts)).
3. **Crawl (BFS).** Starting from the seed(s), for each URL it creates a **`PageDiscovered`** row,
   then runs `auditViewport` on desktop (full checks) and mobile (screenshot + console/image),
   attaching network listeners before navigation.
4. **Checks.** Per page: [`linkAudit`](apps/api/src/crawler/checks/linkAudit.ts),
   [`consoleAudit`](apps/api/src/crawler/checks/consoleAudit.ts),
   [`imageAudit`](apps/api/src/crawler/checks/imageAudit.ts),
   [`contentAudit`](apps/api/src/crawler/checks/contentAudit.ts),
   [`performanceAudit`](apps/api/src/crawler/checks/performanceAudit.ts), and
   [`screenshot`](apps/api/src/crawler/checks/screenshot.ts).
5. **Classify & persist.** Findings from both viewports are merged, run through the
   [**categorization engine**](apps/api/src/crawler/categorize.ts) (→ category + severity), and
   written as **`BugFound`** rows; the page row and job counters are updated.
6. **Live progress.** After each page the worker emits a `progress` event on the event bus
   ([`queue/events.ts`](apps/api/src/queue/events.ts)); the **SSE** endpoint
   (`GET /api/crawls/:id/stream`) streams it to `JobProgress` in the dashboard. In-domain links are
   enqueued up to the depth / page cap.
7. **Complete.** When the queue drains, the job is marked `completed` and a `done` event is emitted.
8. **Read results.** `BugMatrix` fetches `GET /api/crawls/:id/bugs` with filters; screenshots are
   served by `@fastify/static` from `data/screenshots/<jobId>/`.

---

## ⚙️ Configuration

Set in [`.env`](.env):

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `CRAWL_MAX_DEPTH` | `1` | Recursion depth for site-wide crawls |
| `CRAWL_MAX_PAGES` | `60` | Page cap per job |
| `CRAWL_PAGE_CONCURRENCY` | `3` | Pages crawled in parallel |
| `PERF_LOAD_THRESHOLD_MS` | `4000` | Load time above which a page is flagged as a Performance Bottleneck |

---

## 🔌 API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/seed-urls` | The 26 canonical Ather URLs + root domain |
| `POST` | `/api/crawls` | Trigger a crawl — body `{ mode, url?, maxDepth?, maxPages? }` |
| `GET` | `/api/crawls` | Crawl history |
| `GET` | `/api/crawls/:id` | Job detail + live counters |
| `GET` | `/api/crawls/:id/stream` | **SSE** live progress |
| `GET` | `/api/crawls/:id/pages` | Discovered pages |
| `GET` | `/api/crawls/:id/bugs?category=&severity=&search=` | Filtered bug matrix |

<details>
<summary>Example: trigger + inspect a single-URL crawl</summary>

```bash
JOB=$(curl -s -X POST http://localhost:3001/api/crawls \
  -H 'Content-Type: application/json' \
  -d '{"mode":"single","url":"https://www.atherenergy.com/contact"}' | \
  node -pe 'JSON.parse(require("fs").readFileSync(0)).jobId')

curl -s http://localhost:3001/api/crawls/$JOB
curl -s "http://localhost:3001/api/crawls/$JOB/bugs?category=Server%20Error"
```
</details>

---

## 🧪 Testing & driving the app

```bash
npm test        # vitest — categorization engine unit tests
```

A Playwright **driver** at
[`.claude/skills/run-website-bug-finder/driver.mjs`](.claude/skills/run-website-bug-finder/driver.mjs)
opens the dashboard, triggers a crawl, waits for completion, asserts bugs + screenshots, and
captures a full-page dashboard screenshot:

```bash
# with API (:3001) + dashboard (:5173) running:
node .claude/skills/run-website-bug-finder/driver.mjs --mode single --url https://www.atherenergy.com/contact
node .claude/skills/run-website-bug-finder/driver.mjs --no-ui --mode site --max-pages 5   # API-only
```

See [`.claude/skills/run-website-bug-finder/SKILL.md`](.claude/skills/run-website-bug-finder/SKILL.md)
for the full run playbook and gotchas.

---

## 🌐 Publish to GitHub Pages (GitHub-only)

The platform can be published using **GitHub alone** — no external host. GitHub
Pages serves static files and GitHub Actions runs the crawler in CI, so the
published site is a **static snapshot**: Actions crawls → writes JSON +
screenshots → Pages hosts the dashboard reading them. (The live "Trigger Manual
Crawl" button needs a server, so in the published build it's replaced by a
"re-run the workflow" notice.)

**How it works**
```
 Actions (workflow_dispatch)
   npm run crawl:static   →  apps/web/public/data/{jobs.json, <id>/{pages,bugs}.json, screenshots}
   npm run build          →  static dashboard (VITE_STATIC=1, VITE_BASE=/website_bug_finder/)
   deploy-pages           →  https://<owner>.github.io/website_bug_finder/
```

**One-time setup**
1. Repo **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.
2. That's it — the workflow ([.github/workflows/publish.yml](.github/workflows/publish.yml)) handles the rest.

**Publish / refresh results**
- Go to the **Actions** tab → **"Publish (crawl + Pages)"** → **Run workflow**, choosing:
  - `mode` — `site` (26 seeds + recursion) or `single`
  - `url` (single mode), `maxDepth`, `maxPages` (site mode)
- When it finishes, the site is live at `https://kingbondproduct.github.io/website_bug_finder/`.

**Try the static build locally**
```bash
CRAWL_MODE=single CRAWL_URL=https://www.atherenergy.com/contact npm run crawl:static
VITE_STATIC=1 VITE_BASE=/ npm run build
npx --workspace @bugfinder/web vite preview --port 4173   # → http://localhost:4173
```

> **Notes:** the published site shows the **latest run only** (results aren't committed —
> each run republishes via the Pages artifact). Keep `maxPages` modest — full-page PNGs are
> large and Pages caps files at 100MB / sites at ~1GB. For a custom domain or user/org Pages,
> build with `VITE_BASE=/`.

---

## 📁 Project layout

```
prisma/schema.prisma            # DB schema (CrawlJobs · PagesDiscovered · BugsFound)
packages/shared/src/types.ts    # shared DTOs / category & severity enums
apps/api/src/
  server.ts                     # Fastify app + SSE + static screenshots
  routes/crawls.ts              # REST endpoints
  queue/                        # in-process queue + event bus
  batch.ts                      # CI entry: crawl → static JSON + screenshots (JsonSink)
  crawler/
    engine.ts                   # storage-agnostic BFS orchestrator + CrawlSink interface
    crawl.ts                    # live-worker wrapper (PrismaSink + SSE)
    prismaSink.ts               # DB persistence sink
    categorize.ts               # ⭐ the Bug Categorization Engine
    checks/                     # link · console · image · content · performance · screenshot
apps/web/src/                   # React dashboard (TriggerCrawlPanel · JobProgress · BugMatrix · JobsList)
  api.ts                        # data layer: live (server) + static (Pages) adapters
docs/                           # taxonomy · changelog · roadmap
.github/workflows/publish.yml   # manual crawl → GitHub Pages deploy
.claude/skills/run-website-bug-finder/   # run skill + Playwright driver
```

---

## 📚 Further docs

| Doc | What's inside |
| --- | --- |
| [`docs/BUG_TAXONOMY.md`](docs/BUG_TAXONOMY.md) | Full definitions, signal → category → severity mapping, evidence fields, triage guidance |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Release history & change tracking |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased future roadmap & open ideas |

---

<sub>Built for Ather Energy QA. Backend + crawler in Node/TypeScript, dashboard in React.</sub>
