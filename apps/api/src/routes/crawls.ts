import type { FastifyInstance } from 'fastify';
import type {
  BugCategory,
  BugDTO,
  CrawlJobDTO,
  CreateCrawlRequest,
  PageDTO,
  ProgressEvent,
  Severity,
} from '@bugfinder/shared';
import { BUG_CATEGORIES, SEVERITIES } from '@bugfinder/shared';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { ATHER_SEED_URLS, DEFAULT_ROOT_DOMAIN } from '../seedUrls.js';
import { enqueueCrawl } from '../queue/index.js';
import { jobEvents } from '../queue/events.js';

export async function crawlRoutes(app: FastifyInstance): Promise<void> {
  // The canonical seed list (for the UI to display).
  app.get('/seed-urls', async () => ({ urls: ATHER_SEED_URLS, rootDomain: DEFAULT_ROOT_DOMAIN }));

  // Trigger a crawl (site-wide seeded or single manual URL).
  app.post<{ Body: CreateCrawlRequest }>('/crawls', async (req, reply) => {
    const body = req.body ?? ({} as CreateCrawlRequest);
    const mode = body.mode === 'single' ? 'single' : 'site';

    let seedUrls: string[];
    let rootDomain = DEFAULT_ROOT_DOMAIN;

    if (mode === 'single') {
      if (!body.url) return reply.code(400).send({ error: 'url is required for single mode' });
      let parsed: URL;
      try {
        parsed = new URL(body.url);
      } catch {
        return reply.code(400).send({ error: 'invalid url' });
      }
      seedUrls = [parsed.toString()];
      rootDomain = parsed.hostname;
    } else {
      seedUrls = ATHER_SEED_URLS;
    }

    const maxDepth = mode === 'single' ? 0 : clampInt(body.maxDepth, 0, 4, config.maxDepth);
    const maxPages = clampInt(body.maxPages, 1, 500, config.maxPages);

    const job = await prisma.crawlJob.create({
      data: {
        mode,
        status: 'queued',
        rootDomain,
        seedUrls: JSON.stringify(seedUrls),
        maxDepth,
        maxPages: mode === 'single' ? seedUrls.length : maxPages,
      },
    });

    enqueueCrawl(job.id);
    return reply.code(201).send({ jobId: job.id });
  });

  // Crawl history.
  app.get('/crawls', async () => {
    const jobs = await prisma.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return jobs.map(toJobDTO);
  });

  // Single job detail.
  app.get<{ Params: { id: string } }>('/crawls/:id', async (req, reply) => {
    const job = await prisma.crawlJob.findUnique({ where: { id: req.params.id } });
    if (!job) return reply.code(404).send({ error: 'not found' });
    return toJobDTO(job);
  });

  // Discovered pages for a job.
  app.get<{ Params: { id: string } }>('/crawls/:id/pages', async (req) => {
    const pages = await prisma.pageDiscovered.findMany({
      where: { crawlJobId: req.params.id },
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
    });
    return pages.map(toPageDTO);
  });

  // Filtered, searchable bug matrix.
  app.get<{
    Params: { id: string };
    Querystring: { category?: string; severity?: string; search?: string };
  }>('/crawls/:id/bugs', async (req) => {
    const { category, severity, search } = req.query;
    const where: Record<string, unknown> = { crawlJobId: req.params.id };
    if (category && (BUG_CATEGORIES as readonly string[]).includes(category)) where.category = category;
    if (severity && (SEVERITIES as readonly string[]).includes(severity)) where.severity = severity;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { url: { contains: q } },
        { message: { contains: q } },
        { type: { contains: q } },
      ];
    }
    const bugs = await prisma.bugFound.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }],
      take: 2000,
    });
    return bugs.map(toBugDTO);
  });

  // Live progress via Server-Sent Events.
  app.get<{ Params: { id: string } }>('/crawls/:id/stream', async (req, reply) => {
    const jobId = req.params.id;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event: ProgressEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Emit current snapshot immediately so late subscribers aren't blank.
    const job = await prisma.crawlJob.findUnique({ where: { id: jobId } });
    if (job) {
      send({
        jobId,
        status: job.status as ProgressEvent['status'],
        pagesDiscovered: job.pagesDiscovered,
        pagesCrawled: job.pagesCrawled,
        bugsFound: job.bugsFound,
      });
      if (job.status === 'completed' || job.status === 'failed') {
        reply.raw.end();
        return reply;
      }
    }

    const onProgress = (event: ProgressEvent) => send(event);
    const onDone = () => {
      cleanup();
      reply.raw.write('event: done\ndata: {}\n\n');
      reply.raw.end();
    };
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      jobEvents.off(`progress:${jobId}`, onProgress);
      jobEvents.off(`done:${jobId}`, onDone);
    };

    jobEvents.on(`progress:${jobId}`, onProgress);
    jobEvents.on(`done:${jobId}`, onDone);
    req.raw.on('close', cleanup);

    return reply;
  });
}

// --- mappers ---

type JobRow = Awaited<ReturnType<typeof prisma.crawlJob.findUniqueOrThrow>>;
type PageRow = Awaited<ReturnType<typeof prisma.pageDiscovered.findUniqueOrThrow>>;
type BugRow = Awaited<ReturnType<typeof prisma.bugFound.findUniqueOrThrow>>;

function toJobDTO(j: JobRow): CrawlJobDTO {
  return {
    id: j.id,
    mode: j.mode as CrawlJobDTO['mode'],
    status: j.status as CrawlJobDTO['status'],
    rootDomain: j.rootDomain,
    maxDepth: j.maxDepth,
    maxPages: j.maxPages,
    pagesDiscovered: j.pagesDiscovered,
    pagesCrawled: j.pagesCrawled,
    bugsFound: j.bugsFound,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    finishedAt: j.finishedAt?.toISOString() ?? null,
  };
}

function toPageDTO(p: PageRow): PageDTO {
  return {
    id: p.id,
    url: p.url,
    depth: p.depth,
    discoveredFrom: p.discoveredFrom,
    status: p.status as PageDTO['status'],
    httpStatus: p.httpStatus,
    loadTimeMs: p.loadTimeMs,
    desktopScreenshot: p.desktopScreenshot,
    mobileScreenshot: p.mobileScreenshot,
  };
}

function toBugDTO(b: BugRow): BugDTO {
  return {
    id: b.id,
    url: b.url,
    category: b.category as BugCategory,
    severity: b.severity as Severity,
    type: b.type,
    message: b.message,
    viewport: b.viewport as BugDTO['viewport'],
    evidence: parseEvidence(b.evidence),
    createdAt: b.createdAt.toISOString(),
  };
}

function parseEvidence(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
