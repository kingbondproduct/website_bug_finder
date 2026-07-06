import type { RawFinding, Viewport } from '@bugfinder/shared';
import type { PageCapture } from './networkListeners.js';

const XHR_TYPES = new Set(['xhr', 'fetch']);
const MAX_PER_KIND = 25; // cap noise from chatty pages

/**
 * Reports JavaScript exceptions, console errors and failed XHR/Fetch requests
 * captured during page load.
 */
export function consoleAudit(capture: PageCapture, viewport: Viewport): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const err of capture.pageErrors.slice(0, MAX_PER_KIND)) {
    findings.push({
      type: 'js-exception',
      message: `Uncaught JS exception: ${err}`,
      viewport,
      evidence: { error: err },
    });
  }

  for (const err of capture.consoleErrors.slice(0, MAX_PER_KIND)) {
    findings.push({
      type: 'console-error',
      message: `Console error: ${truncate(err, 300)}`,
      viewport,
      evidence: { error: err },
    });
  }

  const failedXhr = capture.failures.filter((f) => XHR_TYPES.has(f.resourceType));
  for (const f of failedXhr.slice(0, MAX_PER_KIND)) {
    findings.push({
      type: 'failed-request',
      message: `Failed ${f.resourceType.toUpperCase()} request: ${f.url} (${f.errorText})`,
      viewport,
      evidence: { resourceUrl: f.url, errorText: f.errorText, resourceType: f.resourceType },
    });
  }

  return findings;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
