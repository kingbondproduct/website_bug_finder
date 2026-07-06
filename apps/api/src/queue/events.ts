import { EventEmitter } from 'node:events';
import type { JobStatus, ProgressEvent } from '@bugfinder/shared';

// Process-wide event bus. The worker emits progress; the SSE route subscribes.
export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(200);

export function emitProgress(event: ProgressEvent): void {
  jobEvents.emit(`progress:${event.jobId}`, event);
}

export function emitDone(jobId: string, status: JobStatus): void {
  jobEvents.emit(`done:${jobId}`, { jobId, status });
}
