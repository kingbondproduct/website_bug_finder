import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';

/** Where screenshots for one job are written, and how their stored path reads. */
export interface ScreenshotTarget {
  /** Filesystem directory to write PNGs into (created if missing). */
  dir: string;
  /** Prefix for the stored/served path, e.g. "/screenshots/<jobId>" or "data/<jobId>/screenshots". */
  urlPrefix: string;
}

/**
 * Saves a full-page screenshot and returns the path to store on the page row
 * (relative to how the app serves it — Fastify static in server mode, or the
 * Pages base in static mode).
 */
export async function captureScreenshot(
  page: Page,
  target: ScreenshotTarget,
  pageId: string,
  viewport: 'desktop' | 'mobile',
): Promise<string | null> {
  try {
    await mkdir(target.dir, { recursive: true });
    const fileName = `${pageId}-${viewport}.png`;
    await page.screenshot({ path: path.join(target.dir, fileName), fullPage: true });
    return `${target.urlPrefix}/${fileName}`;
  } catch {
    return null;
  }
}
