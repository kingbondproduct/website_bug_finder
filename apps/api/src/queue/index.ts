import PQueue from 'p-queue';
import { runCrawlJob } from '../crawler/crawl.js';

// In-process job queue. Concurrency 1 keeps a single browser alive at a time —
// robust for local use, and swappable for BullMQ/Redis later without touching
// callers (they only see enqueueCrawl).
const jobQueue = new PQueue({ concurrency: 1 });

export function enqueueCrawl(jobId: string): void {
  void jobQueue.add(async () => {
    try {
      await runCrawlJob(jobId);
    } catch (err) {
      // runCrawlJob already records failure state; this is a last-resort guard.
      console.error(`[queue] crawl job ${jobId} crashed:`, err);
    }
  });
}

export function queueDepth(): number {
  return jobQueue.size + jobQueue.pending;
}
