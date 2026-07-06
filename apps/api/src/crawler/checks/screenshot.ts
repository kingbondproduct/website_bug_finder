import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { config } from '../../config.js';

/**
 * Saves a full-page screenshot and returns a web path (relative to the static
 * mount at /screenshots) suitable for storing on the page row and rendering in
 * the dashboard.
 */
export async function captureScreenshot(
  page: Page,
  jobId: string,
  pageId: string,
  viewport: 'desktop' | 'mobile',
): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), config.dataDir, 'screenshots', jobId);
    await mkdir(dir, { recursive: true });
    const fileName = `${pageId}-${viewport}.png`;
    await page.screenshot({ path: path.join(dir, fileName), fullPage: true });
    return `/screenshots/${jobId}/${fileName}`;
  } catch {
    return null;
  }
}
