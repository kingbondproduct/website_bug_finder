import { useEffect, useState } from 'react';
import type { CrawlJobDTO, ProgressEvent } from '../api';
import { api } from '../api';

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-slate-700 text-slate-200',
  running: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  failed: 'bg-red-500/20 text-red-300 border border-red-500/40',
};

export function JobProgress({ job, onUpdated }: { job: CrawlJobDTO; onUpdated: () => void }) {
  const [live, setLive] = useState<ProgressEvent>({
    jobId: job.id,
    status: job.status,
    pagesDiscovered: job.pagesDiscovered,
    pagesCrawled: job.pagesCrawled,
    bugsFound: job.bugsFound,
  });

  useEffect(() => {
    setLive({
      jobId: job.id,
      status: job.status,
      pagesDiscovered: job.pagesDiscovered,
      pagesCrawled: job.pagesCrawled,
      bugsFound: job.bugsFound,
    });

    if (job.status === 'completed' || job.status === 'failed') return;

    const es = new EventSource(api.streamUrl(job.id));
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ProgressEvent;
        setLive(data);
        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
          onUpdated();
        }
      } catch {
        /* ignore */
      }
    };
    es.addEventListener('done', () => {
      es.close();
      onUpdated();
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [job.id, job.status, job.pagesDiscovered, job.pagesCrawled, job.bugsFound, onUpdated]);

  const pct =
    live.pagesDiscovered > 0
      ? Math.min(100, Math.round((live.pagesCrawled / live.pagesDiscovered) * 100))
      : 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {job.mode === 'single' ? 'Manual URL Crawl' : 'Site-wide Crawl'}
          </h2>
          <p className="truncate text-xs text-slate-500">{job.rootDomain}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[live.status] ?? ''}`}>
          {live.status}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ${
            live.status === 'failed' ? 'bg-red-500' : 'bg-ather'
          }`}
          style={{ width: `${live.status === 'completed' ? 100 : pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Discovered" value={live.pagesDiscovered} />
        <Stat label="Crawled" value={live.pagesCrawled} />
        <Stat label="Bugs" value={live.bugsFound} accent />
      </div>

      {live.currentUrl && live.status === 'running' && (
        <p className="mt-3 truncate text-xs text-slate-500">Crawling: {live.currentUrl}</p>
      )}
      {job.error && <p className="mt-3 text-xs text-red-400">Error: {job.error}</p>}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-800/60 py-3">
      <div className={`text-2xl font-semibold ${accent ? 'text-ather' : 'text-slate-100'}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
