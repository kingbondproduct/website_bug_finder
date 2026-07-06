import { useEffect, useMemo, useState } from 'react';
import type { BugCategory, Severity } from '@bugfinder/shared';
import { BUG_CATEGORIES, SEVERITIES } from '@bugfinder/shared';
import type { BugDTO } from '../api';
import { api, SEVERITY_RANK } from '../api';

const CATEGORY_COLOR: Record<BugCategory, string> = {
  'Server Error': 'bg-red-500/15 text-red-300 border-red-500/30',
  'Visual Bug': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Broken Link': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Copy Issue': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Performance Bottleneck': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-orange-500 text-slate-950',
  Medium: 'bg-yellow-400 text-slate-950',
  Low: 'bg-slate-500 text-white',
};

export function BugMatrix({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const [bugs, setBugs] = useState<BugDTO[]>([]);
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getBugs(jobId, { category, severity, search })
      .then((data) => {
        if (!cancelled) setBugs(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, category, severity, search, jobStatus]);

  const sorted = useMemo(
    () => [...bugs].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    [bugs],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of bugs) c[b.category] = (c[b.category] ?? 0) + 1;
    return c;
  }, [bugs]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Bug Matrix</h2>
        <span className="text-xs text-slate-500">{bugs.length} shown</span>
      </div>

      {/* Category summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {BUG_CATEGORIES.map((c) => (
          <span
            key={c}
            className={`rounded-full border px-2.5 py-1 text-xs ${CATEGORY_COLOR[c]}`}
          >
            {c}: {counts[c] ?? 0}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search url / message / type…"
          className="flex-1 min-w-[180px] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
        >
          <option value="">All categories</option>
          {BUG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Severity</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Message</th>
              <th className="px-3 py-2 text-left font-medium">Viewport</th>
              <th className="px-3 py-2 text-left font-medium">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((b) => (
              <tr key={b.id} className="hover:bg-slate-800/30 align-top">
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[b.severity]}`}>
                    {b.severity}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${CATEGORY_COLOR[b.category]}`}>
                    {b.category}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{b.type}</td>
                <td className="px-3 py-2 max-w-md text-slate-200">{b.message}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{b.viewport}</td>
                <td className="px-3 py-2 max-w-[180px]">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-ather hover:underline"
                    title={b.url}
                  >
                    {b.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                  </a>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  {loading ? 'Loading…' : jobStatus === 'running' ? 'Crawling… bugs will appear here.' : 'No bugs match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
