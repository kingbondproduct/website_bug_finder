import PQueue from 'p-queue';
import type { BrowserContext } from 'playwright';
import type { RawFinding, Viewport } from '@bugfinder/shared';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { launchContexts } from './browser.js';
import { attachListeners } from './checks/networkListeners.js';
import { linkAudit } from './checks/linkAudit.js';
import { consoleAudit } from './checks/consoleAudit.js';
import { imageAudit } from './checks/imageAudit.js';
import { contentAudit } from './checks/contentAudit.js';
import { performanceAudit } from './checks/performanceAudit.js';
import { captureScreenshot } from './checks/screenshot.js';
import { categorize } from './categorize.js';
import { emitProgress, emitDone } from '../queue/events.js';

const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|json|pdf|zip|mp4|webm|woff2?|ttf|eot|xml|txt)(?:$|\?)/i;

interface ViewportResult {
  mainStatus: number | null;
  findings: RawFinding[];
  links: string[];
  loadTimeMs: number | null;
  screenshot: string | null;
  loadError: string | null;
}

/** Entry point invoked by the queue worker. */
export async function runCrawlJob(jobId: string): Promise<void> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const seeds: string[] = safeParseArray(job.seedUrls);
  const rootDomain = job.rootDomain;
  const maxDepth = job.maxDepth;
  const maxPages = job.maxPages;

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date() },
  });

  const counters = { discovered: 0, crawled: 0, bugs: 0 };
  const visited = new Set<string>();
  const pageQueue = new PQueue({ concurrency: config.pageConcurrency });

  let contexts: Awaited<ReturnType<typeof launchContexts>> | null = null;

  const enqueue = (url: string, depth: number, from: string | null) => {
    const norm = normalizeUrl(url);
    if (!norm || visited.has(norm)) return;
    if (visited.size >= maxPages) return;
    visited.add(norm);
    counters.discovered = visited.size;
    void pageQueue.add(() => processUrl(norm, depth, from));
  };

  const processUrl = async (url: string, depth: number, from: string | null): Promise<void> => {
    if (!contexts) return;
    const page = await prisma.pageDiscovered.create({
      data: { crawlJobId: jobId, url, depth, discoveredFrom: from, status: 'pending' },
    });

    try {
      const desktop = await auditViewport(contexts.desktop, url, 'desktop', jobId, page.id, true);
      const mobile = await auditViewport(contexts.mobile, url, 'mobile', jobId, page.id, false);

      const merged = mergeFindings(desktop.findings, mobile.findings);
      // Main-document status → page-level classification (desktop is canonical).
      const mainStatus = desktop.mainStatus ?? mobile.mainStatus;
      if (mainStatus && mainStatus >= 500) {
        merged.push({ type: 'http-5xx', message: `Page returned ${mainStatus}`, viewport: 'both', evidence: { url, statusCode: mainStatus } });
      } else if (mainStatus === 404) {
        merged.push({ type: 'page-404', message: `Page not found (404): ${url}`, viewport: 'both', evidence: { url, statusCode: mainStatus } });
      }
      if (desktop.loadError) {
        merged.push({ type: 'failed-request', message: `Page failed to load: ${desktop.loadError}`, viewport: 'desktop', evidence: { url, error: desktop.loadError } });
      }

      await persistBugs(jobId, page.id, url, merged);
      counters.bugs += merged.length;

      await prisma.pageDiscovered.update({
        where: { id: page.id },
        data: {
          status: desktop.loadError ? 'error' : 'crawled',
          httpStatus: mainStatus ?? null,
          loadTimeMs: desktop.loadTimeMs ?? null,
          desktopScreenshot: desktop.screenshot,
          mobileScreenshot: mobile.screenshot,
        },
      });

      // Recurse into same-domain HTML links.
      if (depth < maxDepth) {
        for (const link of desktop.links) {
          if (isCrawlable(link, rootDomain)) enqueue(link, depth + 1, url);
        }
      }
    } catch (err) {
      await prisma.pageDiscovered
        .update({ where: { id: page.id }, data: { status: 'error' } })
        .catch(() => {});
    } finally {
      counters.crawled += 1;
      await syncCounters(jobId, counters);
      emitProgress({
        jobId,
        status: 'running',
        pagesDiscovered: counters.discovered,
        pagesCrawled: counters.crawled,
        bugsFound: counters.bugs,
        currentUrl: url,
      });
    }
  };

  try {
    contexts = await launchContexts();
    for (const seed of seeds) enqueue(seed, 0, null);
    await pageQueue.onIdle();

    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        pagesDiscovered: counters.discovered,
        pagesCrawled: counters.crawled,
        bugsFound: counters.bugs,
      },
    });
    emitProgress({ jobId, status: 'completed', pagesDiscovered: counters.discovered, pagesCrawled: counters.crawled, bugsFound: counters.bugs, message: 'Crawl complete' });
    emitDone(jobId, 'completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.crawlJob.update({ where: { id: jobId }, data: { status: 'failed', error: message, finishedAt: new Date() } }).catch(() => {});
    emitProgress({ jobId, status: 'failed', pagesDiscovered: counters.discovered, pagesCrawled: counters.crawled, bugsFound: counters.bugs, message });
    emitDone(jobId, 'failed');
  } finally {
    await contexts?.close();
  }
}

async function auditViewport(
  context: BrowserContext,
  url: string,
  viewport: Exclude<Viewport, 'both'>,
  jobId: string,
  pageId: string,
  full: boolean,
): Promise<ViewportResult> {
  const page = await context.newPage();
  const capture = attachListeners(page);
  let mainStatus: number | null = null;
  let loadError: string | null = null;

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.navTimeoutMs });
    mainStatus = response?.status() ?? null;
    // Give lazy content / images a brief chance to settle.
    await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const findings: RawFinding[] = [];
  let links: string[] = [];
  let loadTimeMs: number | null = null;

  if (!loadError) {
    findings.push(...linkAudit(capture, url, viewport));
    findings.push(...consoleAudit(capture, viewport));
    findings.push(...(await imageAudit(page, capture, viewport)));

    if (full) {
      findings.push(...(await contentAudit(page, viewport)));
      const perf = await performanceAudit(page, viewport);
      findings.push(...perf.findings);
      loadTimeMs = perf.loadTimeMs;
      links = await extractLinks(page);
    }
  }

  const screenshot = await captureScreenshot(page, jobId, pageId, viewport);
  await page.close().catch(() => {});

  return { mainStatus, findings, links, loadTimeMs, screenshot, loadError };
}

async function extractLinks(page: import('playwright').Page): Promise<string[]> {
  return page
    .$$eval('a[href]', (els) => els.map((a) => (a as HTMLAnchorElement).href))
    .catch(() => [] as string[]);
}

/** Merge desktop+mobile findings, collapsing duplicates to viewport "both". */
function mergeFindings(desktop: RawFinding[], mobile: RawFinding[]): RawFinding[] {
  const key = (f: RawFinding) =>
    `${f.type}::${(f.evidence?.resourceUrl as string) ?? (f.evidence?.word as string) ?? f.message}`;
  const byKey = new Map<string, RawFinding>();
  for (const f of desktop) byKey.set(key(f), f);
  for (const f of mobile) {
    const k = key(f);
    const existing = byKey.get(k);
    if (existing) existing.viewport = 'both';
    else byKey.set(k, f);
  }
  return [...byKey.values()];
}

async function persistBugs(jobId: string, pageId: string, url: string, findings: RawFinding[]): Promise<void> {
  if (findings.length === 0) return;
  const rows = findings.map((f) => {
    const { category, severity } = categorize(f);
    return {
      crawlJobId: jobId,
      pageId,
      url,
      category,
      severity,
      type: f.type,
      message: f.message,
      viewport: f.viewport,
      evidence: f.evidence ? JSON.stringify(f.evidence) : null,
    };
  });
  await prisma.bugFound.createMany({ data: rows });
}

async function syncCounters(jobId: string, c: { discovered: number; crawled: number; bugs: number }): Promise<void> {
  // Persist denormalized counters after each page (SSE carries the live values too).
  await prisma.crawlJob
    .update({ where: { id: jobId }, data: { pagesDiscovered: c.discovered, pagesCrawled: c.crawled, bugsFound: c.bugs } })
    .catch(() => {});
}

// --- URL helpers ---

function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    let s = u.toString();
    if (u.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

function isCrawlable(link: string, rootDomain: string): boolean {
  const norm = normalizeUrl(link);
  if (!norm) return false;
  try {
    const u = new URL(norm);
    if (u.hostname !== rootDomain) return false;
    if (ASSET_EXT.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function safeParseArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
