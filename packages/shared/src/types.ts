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

/** Root domain the site-wide crawl stays within. */
export const DEFAULT_ROOT_DOMAIN = 'www.atherenergy.com';

/**
 * The canonical set of Ather Energy pages a site-wide crawl always audits, and
 * the quick-pick presets offered when targeting a single URL. Shared by the API
 * seed list and the dashboard's URL pickers.
 */
export const ATHER_SEED_URLS: string[] = [
  'https://www.atherenergy.com/', // Home
  'https://www.atherenergy.com/ather-battery-warranty', // Battery Warranty
  'https://www.atherenergy.com/contact', // Contact
  'https://www.atherenergy.com/blog', // Blog Home
  'https://www.atherenergy.com/flexipay', // Flexipay
  'https://www.atherenergy.com/ather-battery-rental', // Battery Rental
  'https://www.atherenergy.com/ather-assured-buyback', // Assured Buyback
  'https://www.atherenergy.com/450/configurator', // Configurator
  'https://www.atherenergy.com/product/scooter/book/rizta', // Booking Page
  'https://www.atherenergy.com/investor-relations', // Investor Relations
  'https://www.atherenergy.com/ather-ecw', // ECW
  'https://www.atherenergy.com/ather-advantage', // Ather Advantage
  'https://www.atherenergy.com/ather-offers-1', // Offers
  'https://www.atherenergy.com/locate-ather-dealer', // Dealer Locator
  'https://www.atherenergy.com/blog/how-to-calculate-electric-scooter-range', // Blog Article
  'https://www.atherenergy.com/electric-scooter-price-in-bengaluru', // Pricing
  'https://www.atherenergy.com/testride/rizta', // Testride
  'https://www.atherenergy.com/compare-electric-scooter', // Compare
  'https://www.atherenergy.com/blog/author/atul-rajan', // Blog Author
  'https://www.atherenergy.com/electric-scooter-all-models', // All models
  'https://www.atherenergy.com/faq', // FAQ Home
  'https://www.atherenergy.com/rizta', // Product Page
  'https://www.atherenergy.com/charging', // Charging
  'https://www.atherenergy.com/electric-scooter-emi-calculator', // EMI Calculator
  'https://www.atherenergy.com/tco', // TCO
  'https://www.atherenergy.com/atherstack', // Atherstack
];
