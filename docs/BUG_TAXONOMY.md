# 🏷️ Bug Taxonomy & Classification

This is the authoritative definition of how the Ather Website Bug Finder classifies
findings. Every raw signal a crawler check emits carries a machine `type`, and the
**Bug Categorization Engine** ([`apps/api/src/crawler/categorize.ts`](../apps/api/src/crawler/categorize.ts))
maps that `type` to exactly one **category** and one **severity**. This document and that file
must stay in sync.

- **5 categories:** `Server Error` · `Visual Bug` · `Broken Link` · `Copy Issue` · `Performance Bottleneck`
- **4 severities:** `Critical` · `High` · `Medium` · `Low`

---

## Severity scale

| Severity | Meaning | Triage expectation |
| --- | --- | --- |
| **Critical** | Breaks a core user function or an entire page. | Fix immediately / block release. |
| **High** | Significant defect on a key page or flow. | Fix this cycle. |
| **Medium** | Real defect with limited blast radius. | Schedule / batch. |
| **Low** | Cosmetic or low-confidence signal. | Backlog; verify before acting. |

---

## 1. 🔴 Server Error

**Definition.** The page or its runtime failed to execute correctly — either the server
returned a failure status, a network request the page depends on failed, or client-side
JavaScript threw/logged an error. The user sees broken functionality, blank regions, or a
dead page.

**Detected by:** [`checks/linkAudit.ts`](../apps/api/src/crawler/checks/linkAudit.ts) (5xx) and
[`checks/consoleAudit.ts`](../apps/api/src/crawler/checks/consoleAudit.ts) (JS/console/XHR),
plus the main-document status in [`crawl.ts`](../apps/api/src/crawler/crawl.ts).

| Signal (`type`) | Severity | Description |
| --- | --- | --- |
| `http-5xx` | **Critical** | A resource or the page itself returned HTTP `5xx`. |
| `failed-request` | **High** | An XHR/Fetch request failed (network error / aborted). Also used when the main page fails to load. |
| `js-exception` | **High** | An uncaught JavaScript exception (`pageerror`) during load. |
| `console-error` | **Medium** | A `console.error(...)` was logged during load. |

**Business impact:** lost conversions, broken configurators/booking flows, blank hero sections.

---

## 2. 🟣 Visual Bug

**Definition.** The page loaded, but content rendered incorrectly or is missing. Today this
focuses on **broken images** — a strong, low-false-positive visual signal.

**Detected by:** [`checks/imageAudit.ts`](../apps/api/src/crawler/checks/imageAudit.ts).

| Signal (`type`) | Severity | Description |
| --- | --- | --- |
| `broken-image` | **Medium** | An `<img>` has `naturalWidth === 0` after load, or its resource returned a non-`200` status. |

**Business impact:** product/lifestyle imagery missing, broken layout, unprofessional appearance.

> 🔭 *Planned:* layout-shift / overflow detection, viewport-diff (desktop vs mobile) regressions,
> and visual snapshot baselines — see [ROADMAP.md](ROADMAP.md).

---

## 3. 🟠 Broken Link

**Definition.** A navigation destination or a linked resource is unreachable or misrouted.

**Detected by:** [`checks/linkAudit.ts`](../apps/api/src/crawler/checks/linkAudit.ts) (observed
sub-resource responses) and the main-document status in
[`crawl.ts`](../apps/api/src/crawler/crawl.ts).

| Signal (`type`) | Severity | Description |
| --- | --- | --- |
| `page-404` | **High** | The crawled page itself returned HTTP `404`. |
| `broken-link` | **Medium** | A sub-resource / linked asset returned a `4xx`. |
| `bad-redirect` | **Medium** | A redirect chain resolved to an error status. |

**Business impact:** dead ends in the funnel, broken CTAs, SEO crawl-budget waste and ranking loss.

---

## 4. 🔵 Copy Issue

**Definition.** The text content itself is wrong — unfinished, leaked from a template, or
misspelled. These are consumer-facing quality defects.

**Detected by:** [`checks/contentAudit.ts`](../apps/api/src/crawler/checks/contentAudit.ts)
(placeholder regexes + offline `nspell` spell-check).

| Signal (`type`) | Severity | Description |
| --- | --- | --- |
| `placeholder-text` | **High** | Leaked placeholder / template content: `Lorem Ipsum`, `undefined`, `NaN`, `null`, `{{variable}}`, `[object Object]`, `%s`/`%d`, `TODO`/`FIXME`. |
| `spelling` | **Low** | A word failed the offline dictionary. Low severity — brand/product terms are allow-listed, but review before acting. |

**Business impact:** signals an unfinished/unreviewed page; directly undermines brand credibility.

> ℹ️ Spell-check is intentionally conservative (skips proper nouns, ALL-CAPS, and an Ather
> brand allow-list) and is capped per page to limit noise. It is best-effort and degrades
> gracefully if the dictionary can't load.

---

## 5. 🟡 Performance Bottleneck

**Definition.** The page is technically correct but too slow, hurting experience and SEO.

**Detected by:** [`checks/performanceAudit.ts`](../apps/api/src/crawler/checks/performanceAudit.ts)
via the Navigation Timing API.

| Signal (`type`) | Severity | Description |
| --- | --- | --- |
| `slow-load` | **Medium** | Page load exceeded `PERF_LOAD_THRESHOLD_MS` (default `4000`ms). |

**Business impact:** higher bounce rates (especially on mobile), lower conversion, weaker Core-Web-Vitals-driven ranking.

> 🔭 *Planned:* per-metric Core Web Vitals (LCP / CLS / INP) with graded severities — see [ROADMAP.md](ROADMAP.md).

---

## Evidence attached to each bug

Every bug row stores a JSON `evidence` blob (rendered in the dashboard) so a reviewer can act
without re-crawling. Common fields:

| Field | Appears on | Meaning |
| --- | --- | --- |
| `resourceUrl` | link / image / request bugs | The failing URL. |
| `statusCode` | link / server bugs | HTTP status observed. |
| `selector`, `naturalWidth`, `alt` | `broken-image` | Which image and why it's flagged. |
| `error` | `js-exception`, `console-error` | The error message. |
| `pattern`, `snippet` | `placeholder-text` | Which pattern matched and surrounding text. |
| `word` | `spelling` | The flagged word. |
| `loadMs`, `thresholdMs` | `slow-load` | Measured vs threshold. |

Bugs also carry a **`viewport`** tag — `desktop`, `mobile`, or `both` (when the same issue was
seen in both viewports).

---

## Adding or changing a classification

1. Emit a new `type` from the relevant check under
   [`apps/api/src/crawler/checks/`](../apps/api/src/crawler/checks/).
2. Add a rule for that `type` in
   [`categorize.ts`](../apps/api/src/crawler/categorize.ts) (`{ category, severity }`).
3. Add a unit test in [`apps/api/tests/categorize.test.ts`](../apps/api/tests/categorize.test.ts).
4. Update the tables in this doc.

> Unmapped types fall back to `Server Error` / `Low` so nothing is ever silently dropped.
