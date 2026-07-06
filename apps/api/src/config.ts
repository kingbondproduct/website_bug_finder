// Central runtime config, sourced from environment with sane defaults.
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 3001),
  maxDepth: num('CRAWL_MAX_DEPTH', 1),
  maxPages: num('CRAWL_MAX_PAGES', 60),
  pageConcurrency: num('CRAWL_PAGE_CONCURRENCY', 3),
  perfLoadThresholdMs: num('PERF_LOAD_THRESHOLD_MS', 4000),
  navTimeoutMs: num('CRAWL_NAV_TIMEOUT_MS', 30000),
  // Where full-page screenshots are written (served statically under /screenshots).
  dataDir: 'data',
} as const;
