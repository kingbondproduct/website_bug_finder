import PQueue from 'p-queue';
import type { BrowserContext, Page } from 'playwright';
import type { BugCategory, RawFinding, Severity, Viewport } from '@bugfinder/shared';
import { config } from '../config.js';
import { launchContexts } from './browser.js';
import { attachListeners } from './checks/networkListeners.js';
import { linkAudit } from './checks/linkAudit.js';
import { consoleAudit } from './checks/consoleAudit.js';
import { imageAudit } from './checks/imageAudit.js';
import { contentAudit } from './checks/contentAudit.js';
import { performanceAudit } from './checks/performanceAudit.js';
import { captureScreenshot, type ScreenshotTarget } from './checks/screenshot.js';
import { categorize } from './categorize.js';

const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|json|pdf|zip|mp4|webm|woff2?|ttf|eot|xml|txt)(?:$|\?)/i;

// ---- storage-agnostic contracts ----

export interface CrawlConfig {
  seeds: string[];
  rootDomain: string;
  maxDepth: number;
  maxPages: number;
  /** Where per-page screenshots are written + how their stored path reads. */
  screenshot: ScreenshotTarget;
}

export interface PageInput {
  url: string;
  depth: number;
  discoveredFrom: string | null;
}

export interface PageResult {
  status: 'crawled' | 'error';
  httpStatus: number | null;
  loadTimeMs: number | null;
  desktopScreenshot: string | null;
  mobileScreenshot: string | null;
}

export interface CrawlBug {
  url: string;
  category: BugCategory;
  severity: Severity;
  type: string;
  message: string;
  viewport: Viewport;
  evidence: Record<string, unknown> | null;
}

/** A destination for crawl output — implemented by PrismaSink (server) and JsonSink (CI). */
export interface CrawlSink {
  createPage(input: PageInput): Promise<{ id: string }>;
  finishPage(id: string, result: PageResult): Promise<void>;
  addBugs(pageId: string, bugs: CrawlBug[]): Promise<void>;
}

export interface CrawlCounters {
  discovered: number;
  crawled: number;
  bugs: number;
}

export type ProgressFn = (snapshot: CrawlCounters & { currentUrl?: string }) => void;

interface ViewportResult {
  mainStatus: number | null;
  findings: RawFinding[];
  links: string[];
  loadTimeMs: number | null;
  screenshot: string | null;
  loadError: string | null;
}

/**
 * The shared crawl orchestrator: launches desktop + mobile browsers, does a
 * BFS from the seeds, runs every check per page, categorizes findings, and
 * streams results to `sink`. Storage-agnostic — no database or filesystem
 * assumptions beyond the screenshot target it's handed.
 */
export async function crawlSite(
  cfg: CrawlConfig,
  sink: CrawlSink,
  onProgress?: ProgressFn,
): Promise<CrawlCounters> {
  const counters: CrawlCounters = { discovered: 0, crawled: 0, bugs: 0 };
  const visited = new Set<string>();
  const pageQueue = new PQueue({ concurrency: config.pageConcurrency });
  let contexts: Awaited<ReturnType<typeof launchContexts>> | null = null;

  const enqueue = (url: string, depth: number, from: string | null) => {
    const norm = normalizeUrl(url);
    if (!norm || visited.has(norm)) return;
    if (visited.size >= cfg.maxPages) return;
    visited.add(norm);
    counters.discovered = visited.size;
    void pageQueue.add(() => processUrl(norm, depth, from));
  };

  const processUrl = async (url: string, depth: number, from: string | null): Promise<void> => {
    if (!contexts) return;
    const { id: pageId } = await sink.createPage({ url, depth, discoveredFrom: from });

    try {
      const desktop = await auditViewport(contexts.desktop, url, 'desktop', cfg.screenshot, pageId, true);
      const mobile = await auditViewport(contexts.mobile, url, 'mobile', cfg.screenshot, pageId, false);

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

      await sink.addBugs(pageId, merged.map((f) => toBug(url, f)));
      counters.bugs += merged.length;

      await sink.finishPage(pageId, {
        status: desktop.loadError ? 'error' : 'crawled',
        httpStatus: mainStatus ?? null,
        loadTimeMs: desktop.loadTimeMs ?? null,
        desktopScreenshot: desktop.screenshot,
        mobileScreenshot: mobile.screenshot,
      });

      // Recurse into same-domain HTML links.
      if (depth < cfg.maxDepth) {
        for (const link of desktop.links) {
          if (isCrawlable(link, cfg.rootDomain)) enqueue(link, depth + 1, url);
        }
      }
    } catch {
      await sink.finishPage(pageId, {
        status: 'error',
        httpStatus: null,
        loadTimeMs: null,
        desktopScreenshot: null,
        mobileScreenshot: null,
      }).catch(() => {});
    } finally {
      counters.crawled += 1;
      onProgress?.({ ...counters, currentUrl: url });
    }
  };

  try {
    contexts = await launchContexts();
    for (const seed of cfg.seeds) enqueue(seed, 0, null);
    await pageQueue.onIdle();
    return counters;
  } finally {
    await contexts?.close();
  }
}

function toBug(url: string, f: RawFinding): CrawlBug {
  const { category, severity } = categorize(f);
  return {
    url,
    category,
    severity,
    type: f.type,
    message: f.message,
    viewport: f.viewport,
    evidence: f.evidence ?? null,
  };
}

async function auditViewport(
  context: BrowserContext,
  url: string,
  viewport: Exclude<Viewport, 'both'>,
  screenshot: ScreenshotTarget,
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

  const shot = await captureScreenshot(page, screenshot, pageId, viewport);
  await page.close().catch(() => {});

  return { mainStatus, findings, links, loadTimeMs, screenshot: shot, loadError };
}

async function extractLinks(page: Page): Promise<string[]> {
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

// ---- URL helpers ----

export function normalizeUrl(raw: string, base?: string): string | null {
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
