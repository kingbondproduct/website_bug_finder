#!/usr/bin/env node
// Driver / smoke harness for the Ather Website Bug Finder.
//
// Drives the platform end-to-end the way a human would: opens the React
// dashboard, clicks "Trigger Manual Crawl", waits for the crawl to finish,
// asserts bugs + screenshots were produced, and captures a full-page
// screenshot of the dashboard showing the results.
//
// Also usable API-only (no dashboard): pass --no-ui.
//
// Requires: API on :3001 (npm start) and — unless --no-ui — the web dev
// server on :5173 (npm run dev:web). Chromium comes from the project's own
// Playwright install (npx playwright install chromium).
//
// Usage:
//   node .claude/skills/run-website-bug-finder/driver.mjs
//   node .claude/skills/run-website-bug-finder/driver.mjs --mode single --url https://www.atherenergy.com/contact
//   node .claude/skills/run-website-bug-finder/driver.mjs --mode site --max-pages 8 --max-depth 1
//   node .claude/skills/run-website-bug-finder/driver.mjs --no-ui
//
// Exit code 0 = crawl completed and produced results; non-zero = failure.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const API = args.api ?? 'http://localhost:3001';
const WEB = args.web ?? 'http://localhost:5173';
const MODE = args.mode === 'site' ? 'site' : 'single';
const URL = args.url ?? 'https://www.atherenergy.com/contact';
const USE_UI = !args['no-ui'];
const OUT = args.out ?? path.join(process.cwd(), 'data', 'driver-dashboard.png');
const TIMEOUT_MS = Number(args.timeout ?? 180000);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

const log = (...m) => console.log('[driver]', ...m);
const fail = (msg) => { console.error('[driver] FAIL:', msg); process.exit(1); };

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    try {
      const h = await getJson(`${API}/api/health`);
      if (h.ok) return;
    } catch { /* retry */ }
    await sleep(1000);
  }
  fail(`API never became healthy at ${API}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestJobId() {
  const jobs = await getJson(`${API}/api/crawls`);
  return jobs[0]?.id ?? null;
}

async function waitForJob(jobId, deadline) {
  while (Date.now() < deadline) {
    const job = await getJson(`${API}/api/crawls/${jobId}`);
    process.stdout.write(`\r[driver] job ${jobId.slice(0, 8)} status=${job.status} pages=${job.pagesCrawled} bugs=${job.bugsFound}   `);
    if (job.status === 'completed' || job.status === 'failed') { console.log(); return job; }
    await sleep(1500);
  }
  console.log();
  fail(`job ${jobId} did not finish within ${TIMEOUT_MS}ms`);
}

async function summarize(jobId) {
  const bugs = await getJson(`${API}/api/crawls/${jobId}/bugs`);
  const pages = await getJson(`${API}/api/crawls/${jobId}/pages`);
  const byCat = {};
  for (const b of bugs) byCat[b.category] = (byCat[b.category] ?? 0) + 1;
  return { bugs, pages, byCat };
}

async function main() {
  log(`API=${API} WEB=${WEB} mode=${MODE} ui=${USE_UI}`);
  await waitForApi();
  const before = await latestJobId();
  const deadline = Date.now() + TIMEOUT_MS;

  let jobId;

  if (USE_UI) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
    try {
      log(`opening dashboard ${WEB}`);
      await page.goto(WEB, { waitUntil: 'networkidle', timeout: 30000 });
      const triggerBtn = page.getByRole('button', { name: 'Trigger Manual Crawl' });
      await triggerBtn.waitFor({ timeout: 10000 });

      // The mode toggle labels are exact; job-history entries also contain the
      // words "Single URL" / "Site-wide", so match exactly to avoid collisions.
      if (MODE === 'single') {
        await page.getByRole('button', { name: 'Single URL', exact: true }).click();
        const input = page.getByRole('textbox').first();
        await input.fill(URL);
      } else {
        await page.getByRole('button', { name: 'Site-wide (26 seeds)', exact: true }).click();
      }

      log('clicking "Trigger Manual Crawl"');
      await page.getByRole('button', { name: 'Trigger Manual Crawl' }).click();

      // Find the new job id created by the click.
      for (let i = 0; i < 20 && !jobId; i++) {
        const id = await latestJobId();
        if (id && id !== before) jobId = id;
        else await sleep(500);
      }
      if (!jobId) fail('no new job appeared after clicking Trigger Manual Crawl');
      log(`triggered job ${jobId}`);

      const job = await waitForJob(jobId, deadline);

      // Reload so the bug matrix fetches the completed job's rows, then shoot.
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
      mkdirSync(path.dirname(OUT), { recursive: true });
      await page.screenshot({ path: OUT, fullPage: true });
      log(`dashboard screenshot -> ${OUT}`);

      if (job.status !== 'completed') fail(`job ended as ${job.status}: ${job.error ?? ''}`);
    } finally {
      await browser.close();
    }
  } else {
    // API-only path.
    const res = await fetch(`${API}/api/crawls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(MODE === 'single' ? { mode: 'single', url: URL } : { mode: 'site', maxDepth: Number(args['max-depth'] ?? 1), maxPages: Number(args['max-pages'] ?? 8) }),
    });
    if (!res.ok) fail(`POST /api/crawls -> ${res.status}`);
    ({ jobId } = await res.json());
    log(`triggered job ${jobId}`);
    const job = await waitForJob(jobId, deadline);
    if (job.status !== 'completed') fail(`job ended as ${job.status}: ${job.error ?? ''}`);
  }

  const { bugs, pages, byCat } = await summarize(jobId);
  log('--- RESULT ---');
  log(`pages crawled: ${pages.length}`);
  log(`bugs found:    ${bugs.length}  ${JSON.stringify(byCat)}`);
  const shots = pages.filter((p) => p.desktopScreenshot && p.mobileScreenshot).length;
  log(`pages with desktop+mobile screenshots: ${shots}/${pages.length}`);

  if (pages.length === 0) fail('no pages were crawled');
  if (shots === 0) fail('no screenshots were captured');
  log('OK ✅');
}

main().catch((e) => fail(e?.stack ?? String(e)));
