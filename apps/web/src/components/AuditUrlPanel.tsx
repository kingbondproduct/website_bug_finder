import { useState } from 'react';
import { ATHER_SEED_URLS } from '@bugfinder/shared';
import { actionsDispatchUrl, isValidHttpUrl, isAtherUrl } from '../urls';

/**
 * Published (static) build panel. The site is served from GitHub Pages with no
 * backend, so it can't crawl on demand. Instead this lets a user pick/paste an
 * Ather URL and hands off to the GitHub Actions "Publish" workflow (single
 * mode): we copy the URL to the clipboard and open the dispatch page, since
 * GitHub can't pre-fill workflow inputs. The result lands in Crawl History once
 * the run finishes.
 */
export function AuditUrlPanel() {
  const [url, setUrl] = useState('https://www.atherenergy.com/rizta');
  const [copied, setCopied] = useState(false);

  const urlValid = isValidHttpUrl(url);
  const urlOffDomain = urlValid && !isAtherUrl(url);

  const audit = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard may be blocked; opening the tab is the important part */
    }
    window.open(actionsDispatchUrl(), '_blank', 'noopener');
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">
        Audit a specific URL
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        This is a published snapshot (no live backend). Crawls run via GitHub Actions.
      </p>

      <label className="block mb-3">
        <span className="text-xs text-slate-400">Ather URL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          list="ather-seed-urls"
          placeholder="https://www.atherenergy.com/…"
          className={`mt-1 w-full rounded-lg bg-slate-800 border px-3 py-2 text-sm focus:outline-none ${
            url && !urlValid ? 'border-red-500/60 focus:border-red-500' : 'border-slate-700 focus:border-ather'
          }`}
        />
        <datalist id="ather-seed-urls">
          {ATHER_SEED_URLS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {url && !urlValid && (
          <span className="mt-1 block text-xs text-red-400">Not a valid http(s) URL.</span>
        )}
        {urlOffDomain && (
          <span className="mt-1 block text-xs text-amber-400">
            Not an atherenergy.com URL — it will still be crawled.
          </span>
        )}
      </label>

      <button
        onClick={audit}
        disabled={!urlValid}
        className="w-full rounded-lg bg-ather px-4 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50 transition"
      >
        {copied ? 'URL copied — opening Actions…' : 'Audit this URL →'}
      </button>

      <ol className="mt-4 space-y-1 text-xs text-slate-400 list-decimal list-inside">
        <li>The URL is copied to your clipboard and the Actions page opens.</li>
        <li>
          Choose <span className="text-slate-300">mode = single</span>, paste the URL, and click{' '}
          <span className="text-slate-300">Run workflow</span>.
        </li>
        <li>When it finishes, the result appears in Crawl History here.</li>
      </ol>
    </section>
  );
}
