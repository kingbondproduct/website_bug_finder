import { useCallback, useEffect, useState } from 'react';
import type { CrawlMode } from '@bugfinder/shared';
import type { CrawlJobDTO } from './api';
import { api, IS_STATIC } from './api';
import { TriggerCrawlPanel } from './components/TriggerCrawlPanel';
import { AuditUrlPanel } from './components/AuditUrlPanel';
import { JobProgress } from './components/JobProgress';
import { JobsList } from './components/JobsList';
import { BugMatrix } from './components/BugMatrix';

/** Prefill the Trigger panel from a shareable link, e.g. ?url=…&mode=single&run=1 */
function readCrawlQuery(): { mode?: CrawlMode; url?: string; run?: boolean } {
  const q = new URLSearchParams(window.location.search);
  const url = q.get('url') ?? undefined;
  const mode = q.get('mode') === 'single' || url ? 'single' : undefined;
  return { url, mode: mode as CrawlMode | undefined, run: q.get('run') === '1' };
}

export function App() {
  const [jobs, setJobs] = useState<CrawlJobDTO[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [crawlQuery] = useState(readCrawlQuery);

  const refreshJobs = useCallback(async () => {
    try {
      const list = await api.listJobs();
      setJobs(list);
      setSelectedJobId((cur) => cur ?? list[0]?.id ?? null);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const handleTriggered = useCallback(
    async (jobId: string) => {
      setSelectedJobId(jobId);
      await refreshJobs();
    },
    [refreshJobs],
  );

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  // Most-recent crawl timestamp (jobs are returned newest-first).
  const lastCrawledIso = jobs[0]?.finishedAt ?? jobs[0]?.createdAt ?? null;
  const lastCrawled = lastCrawledIso ? new Date(lastCrawledIso).toLocaleString() : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ather flex items-center justify-center font-bold text-slate-950">
              A
            </div>
            <div>
              <h1 className="text-lg font-semibold">Ather Website Bug Finder</h1>
              <p className="text-xs text-slate-400">
                Desktop + Mobile crawl · Server / Visual / Link / Copy / Performance audits
              </p>
            </div>
          </div>
          {IS_STATIC && lastCrawled && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Last crawled</div>
              <div className="text-xs text-slate-300">{lastCrawled}</div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {IS_STATIC ? (
            <AuditUrlPanel />
          ) : (
            <TriggerCrawlPanel
              onTriggered={handleTriggered}
              initialMode={crawlQuery.mode}
              initialUrl={crawlQuery.url}
              autoRun={crawlQuery.run}
            />
          )}
          <JobsList jobs={jobs} selectedJobId={selectedJobId} onSelect={setSelectedJobId} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedJob ? (
            <>
              <JobProgress job={selectedJob} onUpdated={refreshJobs} />
              <BugMatrix jobId={selectedJob.id} jobStatus={selectedJob.status} />
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-400">
              Trigger a crawl to see results.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
