import { chromium, devices, type Browser, type BrowserContext } from 'playwright';
import type { Viewport } from '@bugfinder/shared';

// Desktop 1920x1080 and Mobile iPhone 12 Pro (390x844) contexts, per requirements.
const iPhone = devices['iPhone 12 Pro'];

export interface ViewportContexts {
  browser: Browser;
  desktop: BrowserContext;
  mobile: BrowserContext;
  close(): Promise<void>;
}

export async function launchContexts(): Promise<ViewportContexts> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const desktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const mobile = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });

  return {
    browser,
    desktop,
    mobile,
    async close() {
      await desktop.close().catch(() => {});
      await mobile.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export function contextFor(vc: ViewportContexts, viewport: Exclude<Viewport, 'both'>): BrowserContext {
  return viewport === 'desktop' ? vc.desktop : vc.mobile;
}
