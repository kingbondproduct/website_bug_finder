import type { Page, Response, Request } from 'playwright';

/**
 * Captures everything the network/console layer sees during a page load.
 * A single set of listeners feeds linkAudit, consoleAudit and imageAudit.
 */
export interface CapturedResponse {
  url: string;
  status: number;
  resourceType: string;
  fromRedirect: boolean;
}

export interface CapturedFailure {
  url: string;
  resourceType: string;
  errorText: string;
}

export interface PageCapture {
  responses: CapturedResponse[];
  failures: CapturedFailure[];
  consoleErrors: string[];
  pageErrors: string[];
  /** status by URL, for cross-referencing image/link resources. */
  statusByUrl: Map<string, number>;
}

export function attachListeners(page: Page): PageCapture {
  const capture: PageCapture = {
    responses: [],
    failures: [],
    consoleErrors: [],
    pageErrors: [],
    statusByUrl: new Map(),
  };

  page.on('response', (res: Response) => {
    const req = res.request();
    capture.statusByUrl.set(res.url(), res.status());
    capture.responses.push({
      url: res.url(),
      status: res.status(),
      resourceType: req.resourceType(),
      fromRedirect: req.redirectedFrom() !== null,
    });
  });

  page.on('requestfailed', (req: Request) => {
    // requestfailed fires for aborted/blocked/network-error requests, incl. failed XHR/fetch.
    capture.failures.push({
      url: req.url(),
      resourceType: req.resourceType(),
      errorText: req.failure()?.errorText ?? 'unknown error',
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') capture.consoleErrors.push(msg.text());
  });

  page.on('pageerror', (err) => {
    capture.pageErrors.push(err.message);
  });

  return capture;
}
