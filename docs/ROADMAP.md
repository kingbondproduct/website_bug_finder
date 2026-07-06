# 🗺️ Roadmap

Where the Ather Website Bug Finder is headed. This is a living document — priorities shift
with QA needs. Items are grouped by horizon, not committed dates.

**Legend:** 🟢 planned · 🟡 exploring · ⚪ idea/backlog

---

## Now → Next (v1.x) — harden & broaden coverage

| Status | Item | Category | Notes |
| --- | --- | --- | --- |
| 🟢 | **Active link probing** | Broken Link | HEAD-check anchor targets not observed during load (capped, polite), incl. external links. |
| 🟢 | **Core Web Vitals** | Performance | LCP / CLS / INP with per-metric graded severities, replacing the single load threshold. |
| 🟢 | **Scheduled crawls** | Platform | Cron-style recurring audits (e.g. nightly) with run-over-run comparison. |
| 🟢 | **Exports** | Platform | Download a job's bugs as CSV / JSON for sharing and ticket creation. |
| 🟡 | **Accessibility audit (a11y)** | New category? | Integrate `axe-core` for WCAG checks (contrast, alt text, labels, roles). |
| 🟡 | **Config-driven thresholds per page type** | Platform | Different perf/severity budgets for marketing vs. app pages. |

---

## Later (v2) — regression & scale

| Status | Item | Category | Notes |
| --- | --- | --- | --- |
| 🟡 | **Visual regression / snapshot diffing** | Visual Bug | Baseline screenshots; flag pixel/layout drift between runs and across viewports. |
| 🟡 | **Layout-shift & overflow detection** | Visual Bug | Catch clipped text, horizontal scroll, overlapping elements. |
| 🟡 | **BullMQ + Redis queue** | Platform | Multi-worker, parallel jobs, retries, and back-pressure (drop-in behind `enqueueCrawl`). |
| 🟡 | **PostgreSQL option** | Platform | Swap SQLite → Postgres for multi-user / hosted deployments (Prisma makes this a datasource change). |
| ⚪ | **Auth & multi-tenant** | Platform | User accounts, per-team crawl history and saved views. |
| ⚪ | **Deduplication & noise scoring** | Platform | Collapse the same defect seen across many pages; confidence scoring for spell-check. |

---

## Exploring / ideas (unscheduled)

| Status | Item | Notes |
| --- | --- | --- |
| ⚪ | **CI/CD gate** | Run a scoped crawl on preview deploys; fail the build on new Critical/High bugs. |
| ⚪ | **Slack / email alerts** | Notify QA channel when a scheduled crawl finds Critical issues. |
| ⚪ | **LLM-assisted copy review** | Grammar/tone beyond spell-check for consumer-facing strings. |
| ⚪ | **Form / flow interaction testing** | Drive booking / test-ride / configurator flows, not just page loads. |
| ⚪ | **Historical trend dashboards** | Bug counts by category/severity over time; regressions surfaced. |
| ⚪ | **Multi-locale crawling** | Audit language/region variants of pages. |

---

## Design principles guiding the roadmap

1. **Every finding maps to the 5-category taxonomy** — new checks slot into existing categories
   (or a new category is added deliberately, with taxonomy + tests updated together).
2. **Swap-ability over rewrites** — queue and DB are behind thin seams (`enqueueCrawl`, Prisma)
   so scaling up doesn't touch the crawler.
3. **Signal over noise** — new detectors ship with allow-lists / thresholds / caps so QA triage
   stays trustworthy.
4. **Politeness to the live site** — concurrency limits and capped probing; the tool audits, it
   doesn't hammer.

---

## Contributing an item

Open an issue describing the check or feature, which **category/severity** it maps to (or why a
new category is warranted), and the expected **evidence** fields. See
[BUG_TAXONOMY.md](BUG_TAXONOMY.md) for the classification contract and
[CHANGELOG.md](CHANGELOG.md) to log the change.
