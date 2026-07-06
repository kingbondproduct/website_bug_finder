# 📋 Changelog

All notable changes to the Ather Website Bug Finder are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **How to use this file:** add new entries under `[Unreleased]` as you work. On release,
> rename `[Unreleased]` to the version + date and start a fresh `[Unreleased]` section.

---

## [Unreleased]

### Added
- **GitHub-only publishing** — a `workflow_dispatch` Actions workflow
  (`.github/workflows/publish.yml`) crawls in CI and deploys a static dashboard
  to GitHub Pages. New `apps/api/src/batch.ts` (`npm run crawl:static`) emits
  `data/{jobs.json, <id>/{pages,bugs}.json, screenshots}`.
- **Static frontend mode** — `apps/web/src/api.ts` reads pre-generated JSON when
  built with `VITE_STATIC=1`; `App` shows a "published snapshot" notice in place
  of the live trigger panel. `VITE_BASE` sets the Pages sub-path.

### Changed
- **Storage-agnostic crawl engine** — extracted `crawler/engine.ts`
  (`crawlSite` + `CrawlSink` interface) shared by the live worker
  (`PrismaSink`) and CI batch runner (`JsonSink`); `crawl.ts` is now a thin
  wrapper. `checks/screenshot.ts` takes a configurable output dir + URL prefix.

### Fixed
- _(nothing yet)_

---

## [1.0.0] — 2026-07-06

Initial release. End-to-end crawl → classify → review platform, verified locally.

### Added
- **Crawler engine** (Playwright, Chromium) with dual-viewport support — Desktop `1920×1080`
  and Mobile `iPhone 12 Pro (390×844)`.
- **Recursive crawl orchestrator** — seeds the 26 canonical Ather pages, follows in-domain
  links to a configurable depth / page cap, with polite concurrency and per-page isolation.
- **Six per-page checks:** link/network audit, console/JS/XHR audit, broken-image audit,
  content/copy audit (placeholder regexes + offline `nspell` spell-check), performance audit
  (Navigation Timing), and full-page screenshots (desktop + mobile).
- **Bug Categorization Engine** — strict 5-category taxonomy with per-signal severities
  (see [BUG_TAXONOMY.md](BUG_TAXONOMY.md)).
- **Fastify API** — trigger/list/detail crawl endpoints, discovered-pages, filterable bug
  matrix, seed URLs, and **SSE** live progress; static serving of screenshots.
- **In-process queue** (`p-queue`, concurrency 1) — no Redis dependency; swappable for BullMQ.
- **SQLite + Prisma** persistence — `CrawlJobs`, `PagesDiscovered`, `BugsFound`.
- **React + Vite + Tailwind dashboard** — Trigger Crawl panel (site-wide / single URL),
  live progress, crawl history, and a searchable/filterable bug matrix.
- **Run skill + Playwright driver** at `.claude/skills/run-website-bug-finder/` — drives the
  dashboard end-to-end and captures a screenshot; includes an API-only smoke mode.
- **Docs** — README, bug taxonomy, changelog, roadmap.

### Verified
- `npm test` — categorization engine unit tests pass (6/6).
- Single-URL crawl of `/contact` → completed, 1 page, both screenshots, 4 categorized bugs.
- Site-wide recursive crawl (cap 5) → 5 pages, 23 bugs across Server Error / Copy Issue / Broken Link.
- Dashboard driven via Playwright; full bug matrix + progress render correctly.

### Known limitations
- Visual detection is limited to broken images (no layout-shift / snapshot diffing yet).
- Link checking relies on resources observed during load + crawled pages (no exhaustive
  active HEAD probing of every anchor).
- Performance is a single load-time threshold (no per-metric Core Web Vitals yet).
- Spell-check is best-effort and offline; brand terms are allow-listed to reduce noise.
- Single-node, in-process queue — one crawl at a time.

See [ROADMAP.md](ROADMAP.md) for how these are planned to evolve.

---

[Unreleased]: https://github.com/kingbondproduct/website_bug_finder/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kingbondproduct/website_bug_finder/releases/tag/v1.0.0
