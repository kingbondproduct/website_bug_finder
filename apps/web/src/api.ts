import type {
  BugDTO,
  CrawlJobDTO,
  CreateCrawlRequest,
  PageDTO,
  ProgressEvent,
  Severity,
} from '@bugfinder/shared';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/**
 * Static mode: the app is published to GitHub Pages and reads pre-generated
 * JSON produced by the batch crawler (no live API). Toggled at build time via
 * VITE_STATIC=1. Reads are prefixed with Vite's BASE_URL so they resolve under
 * the Pages sub-path (e.g. /website_bug_finder/).
 */
export const IS_STATIC = import.meta.env.VITE_STATIC === '1';
const BASE = import.meta.env.BASE_URL; // '/' in dev, '/website_bug_finder/' on Pages

// ---- static (Pages) implementation ----

const bugsCache = new Map<string, BugDTO[]>();

const staticApi = {
  seedUrls: async () => ({ urls: [] as string[], rootDomain: '' }),

  createCrawl: (_body: CreateCrawlRequest): Promise<{ jobId: string }> => {
    throw new Error('Crawls run via GitHub Actions in the published build.');
  },

  listJobs: () => fetch(`${BASE}data/jobs.json`).then(json<CrawlJobDTO[]>).catch(() => []),

  getJob: async (id: string) => {
    const jobs = await staticApi.listJobs();
    const job = jobs.find((j) => j.id === id);
    if (!job) throw new Error('job not found');
    return job;
  },

  getPages: (id: string) =>
    fetch(`${BASE}data/${id}/pages.json`).then(json<PageDTO[]>).catch(() => [] as PageDTO[]),

  getBugs: async (id: string, filters: { category?: string; severity?: string; search?: string }) => {
    let all = bugsCache.get(id);
    if (!all) {
      all = await fetch(`${BASE}data/${id}/bugs.json`).then(json<BugDTO[]>).catch(() => [] as BugDTO[]);
      bugsCache.set(id, all);
    }
    const q = filters.search?.trim().toLowerCase();
    return all.filter((b) => {
      if (filters.category && b.category !== filters.category) return false;
      if (filters.severity && b.severity !== filters.severity) return false;
      if (q && !(`${b.url} ${b.message} ${b.type}`.toLowerCase().includes(q))) return false;
      return true;
    });
  },

  streamUrl: (id: string) => `${BASE}data/${id}/nostream`, // unused in static mode
};

// ---- live (server) implementation ----

const liveApi = {
  seedUrls: () => fetch('/api/seed-urls').then(json<{ urls: string[]; rootDomain: string }>),

  createCrawl: (body: CreateCrawlRequest) =>
    fetch('/api/crawls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<{ jobId: string }>),

  listJobs: () => fetch('/api/crawls').then(json<CrawlJobDTO[]>),

  getJob: (id: string) => fetch(`/api/crawls/${id}`).then(json<CrawlJobDTO>),

  getPages: (id: string) => fetch(`/api/crawls/${id}/pages`).then(json<PageDTO[]>),

  getBugs: (id: string, filters: { category?: string; severity?: string; search?: string }) => {
    const p = new URLSearchParams();
    if (filters.category) p.set('category', filters.category);
    if (filters.severity) p.set('severity', filters.severity);
    if (filters.search) p.set('search', filters.search);
    const qs = p.toString();
    return fetch(`/api/crawls/${id}/bugs${qs ? `?${qs}` : ''}`).then(json<BugDTO[]>);
  },

  streamUrl: (id: string) => `/api/crawls/${id}/stream`,
};

export const api = IS_STATIC ? staticApi : liveApi;

export type { BugDTO, CrawlJobDTO, PageDTO, ProgressEvent };

export const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};
