import { prisma } from '../db.js';
import type { CrawlBug, CrawlSink, PageInput, PageResult } from './engine.js';

/** CrawlSink that persists to SQLite via Prisma (server / live-worker path). */
export class PrismaSink implements CrawlSink {
  constructor(private readonly jobId: string) {}

  async createPage(input: PageInput): Promise<{ id: string }> {
    const page = await prisma.pageDiscovered.create({
      data: {
        crawlJobId: this.jobId,
        url: input.url,
        depth: input.depth,
        discoveredFrom: input.discoveredFrom,
        status: 'pending',
      },
    });
    return { id: page.id };
  }

  async finishPage(id: string, result: PageResult): Promise<void> {
    await prisma.pageDiscovered.update({
      where: { id },
      data: {
        status: result.status,
        httpStatus: result.httpStatus,
        loadTimeMs: result.loadTimeMs,
        desktopScreenshot: result.desktopScreenshot,
        mobileScreenshot: result.mobileScreenshot,
      },
    });
  }

  async addBugs(pageId: string, bugs: CrawlBug[]): Promise<void> {
    if (bugs.length === 0) return;
    await prisma.bugFound.createMany({
      data: bugs.map((b) => ({
        crawlJobId: this.jobId,
        pageId,
        url: b.url,
        category: b.category,
        severity: b.severity,
        type: b.type,
        message: b.message,
        viewport: b.viewport,
        evidence: b.evidence ? JSON.stringify(b.evidence) : null,
      })),
    });
  }
}
