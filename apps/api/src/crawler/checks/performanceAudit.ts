import type { Page } from 'playwright';
import type { RawFinding, Viewport } from '@bugfinder/shared';
import { config } from '../../config.js';

interface NavTiming {
  loadMs: number;
  domContentLoadedMs: number;
}

/**
 * Reads Navigation Timing and flags a page whose load exceeds the configured
 * threshold as a Performance Bottleneck. Returns the measured load time so the
 * orchestrator can persist it on the page row.
 */
export async function performanceAudit(
  page: Page,
  viewport: Viewport,
): Promise<{ findings: RawFinding[]; loadTimeMs: number | null }> {
  const timing = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!nav) return null;
      return {
        loadMs: Math.round(nav.loadEventEnd - nav.startTime),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      } as NavTiming;
    })
    .catch(() => null);

  if (!timing || timing.loadMs <= 0) return { findings: [], loadTimeMs: timing?.loadMs ?? null };

  const findings: RawFinding[] = [];
  if (timing.loadMs > config.perfLoadThresholdMs) {
    findings.push({
      type: 'slow-load',
      message: `Slow page load: ${timing.loadMs}ms (threshold ${config.perfLoadThresholdMs}ms)`,
      viewport,
      evidence: {
        loadMs: timing.loadMs,
        domContentLoadedMs: timing.domContentLoadedMs,
        thresholdMs: config.perfLoadThresholdMs,
      },
    });
  }

  return { findings, loadTimeMs: timing.loadMs };
}
