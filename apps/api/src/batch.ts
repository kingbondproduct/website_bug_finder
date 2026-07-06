// Batch crawl runner for CI / static publishing.
//
// Reads crawl parameters from env, runs the shared crawl engine against a
// JSON sink (no database), and writes results as static files the Pages
// dashboard reads:
//
//   <out>/data/jobs.json
//   <out>/data/<jobId>/pages.json
//   <out>/data/<jobId>/bugs.json
//   <out>/data/<jobId>/screenshots/*.png
//
// Env:
//   CRAWL_MODE=site|single      (default: site)
//   CRAWL_URL=<url>             (required for single mode)
//   CRAWL_MAX_DEPTH=<n>         (site mode, default 1)
//   CRAWL_MAX_PAGES=<n>         (site mode, default 30)
//   OUT_DIR=<dir>              (default: apps/web/public — Vite copies public/ → dist/)

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BugDTO, CrawlJobDTO, PageDTO } from '@bugfinder/shared';
import {
  crawlSite,
  type CrawlBug,
  type CrawlSink,
  type PageInput,
  type PageResult,
} from './crawler/engine.js';
import { ATHER_SEED_URLS, DEFAULT_ROOT_DOMAIN } from './seedUrls.js';

class JsonSink implements CrawlSink {
  readonly pages: PageDTO[] = [];
  readonly bugs: BugDTO[] = [];
  private readonly stamp = new Date().toISOString();

  async createPage(input: PageInput): Promise<{ id: string }> {
    const id = randomUUID();
    this.pages.push({
      id,
      url: input.url,
      depth: input.depth,
      discoveredFrom: input.discoveredFrom,
      status: 'pending',
      httpStatus: null,
      loadTimeMs: null,
      desktopScreenshot: null,
      mobileScreenshot: null,
    });
    return { id };
  }

  async finishPage(id: string, result: PageResult): Promise<void> {
    const p = this.pages.find((x) => x.id === id);
    if (!p) return;
    p.status = result.status;
    p.httpStatus = result.httpStatus;
    p.loadTimeMs = result.loadTimeMs;
    p.desktopScreenshot = result.desktopScreenshot;
    p.mobileScreenshot = result.mobileScreenshot;
  }

  async addBugs(_pageId: string, bugs: CrawlBug[]): Promise<void> {
    for (const b of bugs) {
      this.bugs.push({
        id: randomUUID(),
        url: b.url,
        category: b.category,
        severity: b.severity,
        type: b.type,
        message: b.message,
        viewport: b.viewport,
        evidence: b.evidence,
        createdAt: this.stamp,
      });
    }
  }
}

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

async function main(): Promise<void> {
  const mode = process.env.CRAWL_MODE === 'single' ? 'single' : 'site';
  const outRoot = process.env.OUT_DIR ?? path.join('apps', 'web', 'public');
  const dataDir = path.join(outRoot, 'data');
  const jobId = randomUUID();

  let seeds: string[];
  let rootDomain: string;
  let maxDepth: number;
  let maxPages: number;

  if (mode === 'single') {
    const raw = process.env.CRAWL_URL;
    if (!raw) throw new Error('CRAWL_URL is required when CRAWL_MODE=single');
    const u = new URL(raw);
    seeds = [u.toString()];
    rootDomain = u.hostname;
    maxDepth = 0;
    maxPages = 1;
  } else {
    seeds = ATHER_SEED_URLS;
    rootDomain = DEFAULT_ROOT_DOMAIN;
    maxDepth = intEnv('CRAWL_MAX_DEPTH', 1);
    maxPages = intEnv('CRAWL_MAX_PAGES', 30);
  }

  const screenshot = {
    dir: path.join(dataDir, jobId, 'screenshots'),
    urlPrefix: `data/${jobId}/screenshots`,
  };

  console.log(`[batch] mode=${mode} rootDomain=${rootDomain} maxDepth=${maxDepth} maxPages=${maxPages}`);
  console.log(`[batch] output → ${dataDir}`);

  const sink = new JsonSink();
  const startedAt = new Date().toISOString();

  const counters = await crawlSite(
    { seeds, rootDomain, maxDepth, maxPages, screenshot },
    sink,
    (c) => process.stdout.write(`\r[batch] discovered=${c.discovered} crawled=${c.crawled} bugs=${c.bugs}   `),
  );
  process.stdout.write('\n');

  const finishedAt = new Date().toISOString();
  const job: CrawlJobDTO = {
    id: jobId,
    mode,
    status: 'completed',
    rootDomain,
    maxDepth,
    maxPages,
    pagesDiscovered: counters.discovered,
    pagesCrawled: counters.crawled,
    bugsFound: counters.bugs,
    error: null,
    createdAt: startedAt,
    startedAt,
    finishedAt,
  };

  await mkdir(path.join(dataDir, jobId), { recursive: true });
  await writeFile(path.join(dataDir, 'jobs.json'), JSON.stringify([job], null, 2));
  await writeFile(path.join(dataDir, jobId, 'pages.json'), JSON.stringify(sink.pages, null, 2));
  await writeFile(path.join(dataDir, jobId, 'bugs.json'), JSON.stringify(sink.bugs, null, 2));

  const byCat: Record<string, number> = {};
  for (const b of sink.bugs) byCat[b.category] = (byCat[b.category] ?? 0) + 1;
  console.log(`[batch] done: ${counters.crawled} pages, ${counters.bugs} bugs ${JSON.stringify(byCat)}`);
  console.log(`[batch] wrote jobs.json + ${jobId}/{pages,bugs}.json + screenshots`);
}

main().catch((err) => {
  console.error('[batch] FAILED:', err);
  process.exit(1);
});
