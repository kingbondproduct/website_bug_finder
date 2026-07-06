import path from 'node:path';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { crawlSite, type CrawlCounters } from './engine.js';
import { PrismaSink } from './prismaSink.js';
import { emitProgress, emitDone } from '../queue/events.js';

/**
 * Live-worker entry point invoked by the queue. Loads the job, runs the shared
 * crawl engine against a Prisma-backed sink, and streams progress over SSE.
 */
export async function runCrawlJob(jobId: string): Promise<void> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const seeds = safeParseArray(job.seedUrls);

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date() },
  });

  const sink = new PrismaSink(jobId);
  const screenshot = {
    dir: path.join(process.cwd(), config.dataDir, 'screenshots', jobId),
    urlPrefix: `/screenshots/${jobId}`,
  };

  const onProgress = (c: CrawlCounters & { currentUrl?: string }) => {
    emitProgress({
      jobId,
      status: 'running',
      pagesDiscovered: c.discovered,
      pagesCrawled: c.crawled,
      bugsFound: c.bugs,
      currentUrl: c.currentUrl,
    });
    // Keep denormalized counters fresh for cheap reads.
    void prisma.crawlJob
      .update({ where: { id: jobId }, data: { pagesDiscovered: c.discovered, pagesCrawled: c.crawled, bugsFound: c.bugs } })
      .catch(() => {});
  };

  try {
    const counters = await crawlSite(
      { seeds, rootDomain: job.rootDomain, maxDepth: job.maxDepth, maxPages: job.maxPages, screenshot },
      sink,
      onProgress,
    );

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
    await prisma.crawlJob
      .update({ where: { id: jobId }, data: { status: 'failed', error: message, finishedAt: new Date() } })
      .catch(() => {});
    emitProgress({ jobId, status: 'failed', pagesDiscovered: 0, pagesCrawled: 0, bugsFound: 0, message });
    emitDone(jobId, 'failed');
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
