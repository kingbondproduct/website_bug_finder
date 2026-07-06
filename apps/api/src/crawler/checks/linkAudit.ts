import type { RawFinding, Viewport } from '@bugfinder/shared';
import type { PageCapture } from './networkListeners.js';

const IGNORE_RESOURCE_TYPES = new Set(['ping', 'beacon', 'csp_report']);

/**
 * Flags 404 / 5xx / broken-redirect resources observed during the page load.
 * The main-document status is handled by the orchestrator (page-404 / http-5xx
 * for the page itself); here we cover every sub-resource and linked asset.
 */
export function linkAudit(
  capture: PageCapture,
  pageUrl: string,
  viewport: Viewport,
): RawFinding[] {
  const findings: RawFinding[] = [];
  const seen = new Set<string>();

  for (const res of capture.responses) {
    if (res.url === pageUrl) continue; // main doc handled separately
    if (res.status < 400) continue;
    if (IGNORE_RESOURCE_TYPES.has(res.resourceType)) continue;
    if (seen.has(res.url)) continue;
    seen.add(res.url);

    if (res.status >= 500) {
      findings.push({
        type: 'http-5xx',
        message: `Resource returned ${res.status}: ${res.url}`,
        viewport,
        evidence: { resourceUrl: res.url, statusCode: res.status, resourceType: res.resourceType },
      });
    } else {
      findings.push({
        type: res.fromRedirect ? 'bad-redirect' : 'broken-link',
        message: `${res.fromRedirect ? 'Redirect resolved to' : 'Broken resource'} ${res.status}: ${res.url}`,
        viewport,
        evidence: { resourceUrl: res.url, statusCode: res.status, resourceType: res.resourceType, fromRedirect: res.fromRedirect },
      });
    }
  }

  return findings;
}
