// Shared domain types used by both the API and the React dashboard.

/** The strict QA classification every bug is tagged into. */
export const BUG_CATEGORIES = [
  'Server Error',
  'Visual Bug',
  'Broken Link',
  'Copy Issue',
  'Performance Bottleneck',
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export type Viewport = 'desktop' | 'mobile' | 'both';

export type CrawlMode = 'site' | 'single';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type PageStatus = 'pending' | 'crawled' | 'error';

/**
 * A raw, uncategorized finding emitted by a single check. The categorization
 * engine turns each of these into a persisted bug with a category + severity.
 */
export interface RawFinding {
  /** Stable machine key used by the categorization engine, e.g. "broken-image". */
  type: string;
  message: string;
  viewport: Viewport;
  evidence?: Record<string, unknown>;
}

// ---- API request/response DTOs ----

export interface CreateCrawlRequest {
  mode: CrawlMode;
  /** Required when mode === "single". */
  url?: string;
  maxDepth?: number;
  maxPages?: number;
}

export interface CrawlJobDTO {
  id: string;
  mode: CrawlMode;
  status: JobStatus;
  rootDomain: string;
  maxDepth: number;
  maxPages: number;
  pagesDiscovered: number;
  pagesCrawled: number;
  bugsFound: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface PageDTO {
  id: string;
  url: string;
  depth: number;
  discoveredFrom: string | null;
  status: PageStatus;
  httpStatus: number | null;
  loadTimeMs: number | null;
  desktopScreenshot: string | null;
  mobileScreenshot: string | null;
}

export interface BugDTO {
  id: string;
  url: string;
  category: BugCategory;
  severity: Severity;
  type: string;
  message: string;
  viewport: Viewport;
  evidence: Record<string, unknown> | null;
  createdAt: string;
}

/** Payload pushed over SSE while a job runs. */
export interface ProgressEvent {
  jobId: string;
  status: JobStatus;
  pagesDiscovered: number;
  pagesCrawled: number;
  bugsFound: number;
  currentUrl?: string;
  message?: string;
}

export interface BugFilters {
  category?: BugCategory;
  severity?: Severity;
  search?: string;
}
