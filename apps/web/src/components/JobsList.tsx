import type { CrawlJobDTO } from '../api';

const DOT: Record<string, string> = {
  queued: 'bg-slate-400',
  running: 'bg-amber-400 animate-pulse',
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
};

export function JobsList({
  jobs,
  selectedJobId,
  onSelect,
}: {
  jobs: CrawlJobDTO[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
        Crawl History
      </h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500">No crawls yet.</p>
      ) : (
        <ul className="space-y-1 max-h-[420px] overflow-y-auto">
          {jobs.map((j) => (
            <li key={j.id}>
              <button
                onClick={() => onSelect(j.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  j.id === selectedJobId ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${DOT[j.status] ?? 'bg-slate-500'}`} />
                  <span className="text-sm font-medium">
                    {j.mode === 'single' ? 'Single URL' : 'Site-wide'}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">
                    {new Date(j.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-xs text-slate-400">
                  <span>{j.pagesCrawled} pages</span>
                  <span className="text-ather">{j.bugsFound} bugs</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
