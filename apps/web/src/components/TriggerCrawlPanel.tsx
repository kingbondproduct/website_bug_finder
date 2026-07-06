import { useState } from 'react';
import type { CrawlMode } from '@bugfinder/shared';
import { api } from '../api';

export function TriggerCrawlPanel({ onTriggered }: { onTriggered: (jobId: string) => void }) {
  const [mode, setMode] = useState<CrawlMode>('site');
  const [url, setUrl] = useState('https://www.atherenergy.com/contact');
  const [maxDepth, setMaxDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { jobId } = await api.createCrawl(
        mode === 'single' ? { mode, url } : { mode, maxDepth, maxPages },
      );
      onTriggered(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start crawl');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
        Trigger Crawl
      </h2>

      <div className="flex rounded-lg bg-slate-800 p-1 mb-4">
        {(['site', 'single'] as CrawlMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m ? 'bg-ather text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            {m === 'site' ? 'Site-wide (26 seeds)' : 'Single URL'}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <label className="block mb-4">
          <span className="text-xs text-slate-400">Target URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.atherenergy.com/…"
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-slate-400">Max depth</span>
            <input
              type="number"
              min={0}
              max={4}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Max pages</span>
            <input
              type="number"
              min={1}
              max={500}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-ather focus:outline-none"
            />
          </label>
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-lg bg-ather px-4 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50 transition"
      >
        {submitting ? 'Starting…' : 'Trigger Manual Crawl'}
      </button>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </section>
  );
}
