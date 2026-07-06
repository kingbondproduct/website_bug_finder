# Ather Website Bug Finder

Automated + manual web crawler and bug-detection platform for the Ather Energy
website. Crawls across **Desktop (1920×1080)** and **Mobile (iPhone 12 Pro,
390×844)** viewports and classifies every finding into a strict QA taxonomy:

> **Server Error · Visual Bug · Broken Link · Copy Issue · Performance Bottleneck**

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Backend    | Node.js + TypeScript, Fastify                                 |
| Crawler    | Playwright (Chromium, multi-viewport)                         |
| Queue      | In-process `p-queue` (no Redis) — swappable for BullMQ later  |
| Database   | SQLite via Prisma                                             |
| Frontend   | Vite + React + TypeScript + Tailwind                          |
| Realtime   | Server-Sent Events (SSE)                                      |

## Architecture

```
React SPA ──REST+SSE──▶ Fastify API ──enqueue──▶ p-queue worker ──▶ Playwright
   (5173)                 (3001)                                    (desktop+mobile)
                             │                                          │
                             ▼                                          ▼
                        SQLite (Prisma): CrawlJobs · PagesDiscovered · BugsFound
```
The API process also hosts the crawl worker. Screenshots are written to
`data/screenshots/<jobId>/` and served under `/screenshots`.

## Checks performed per page

- **Link & network** — 4xx/5xx resources, broken redirects, failed XHR/fetch.
- **Console** — JS exceptions (`pageerror`) and `console.error`.
- **Visual/asset** — broken images (`naturalWidth === 0` or non-200), full-page
  screenshots (desktop + mobile).
- **Content/copy** — placeholder patterns (`Lorem Ipsum`, `undefined`, `NaN`,
  `{{var}}`, `[object Object]`, …) + offline spellcheck (`nspell`).
- **Performance** — Navigation Timing load time vs threshold (default 4s).

## Getting started

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Install the Chromium browser Playwright drives
npx playwright install chromium

# 3. Create the SQLite database + tables
npm run db:migrate

# 4. Run API (:3001) + dashboard (:5173) together
npm run dev
```

Open http://localhost:5173 and click **Trigger Manual Crawl**.

- **Site-wide** audits the 26 canonical Ather pages, then recursively follows
  in-domain links to the configured depth/page cap.
- **Single URL** audits one page (depth 0).

## Configuration (`.env`)

| Var                      | Default | Meaning                          |
| ------------------------ | ------- | -------------------------------- |
| `PORT`                   | 3001    | API port                         |
| `CRAWL_MAX_DEPTH`        | 1       | Recursion depth for site crawls  |
| `CRAWL_MAX_PAGES`        | 60      | Page cap per job                 |
| `CRAWL_PAGE_CONCURRENCY` | 3       | Pages crawled in parallel        |
| `PERF_LOAD_THRESHOLD_MS` | 4000    | Slow-load flag threshold         |

## Tests

```bash
npm test        # vitest — categorization engine
```

## Project layout

```
prisma/schema.prisma          # DB schema
packages/shared/src/types.ts  # shared DTOs / enums
apps/api/src/
  server.ts                   # Fastify app + SSE + static
  queue/                      # in-process queue + event bus
  routes/crawls.ts            # REST endpoints
  crawler/                    # browser, crawl orchestrator, checks, categorize
apps/web/src/                 # React dashboard
```
