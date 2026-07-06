import nspell from 'nspell';

// Load an English dictionary once, defensively — the dictionary-en package has
// shipped a few different module shapes across versions, and spellcheck is a
// "nice to have": if it can't load we simply skip it rather than break a crawl.
type Speller = { correct(word: string): boolean };

let spellerPromise: Promise<Speller | null> | null = null;

async function loadDictionary(): Promise<{ aff: unknown; dic: unknown } | null> {
  try {
    const mod: any = await import('dictionary-en');
    const entry = mod.default ?? mod;

    // Shape A: already { aff, dic }
    if (entry && entry.aff && entry.dic) return entry;

    // Shape B/C: a function — either node-style callback (dictionary-en@3) or
    // promise-returning. Handle both with a single invocation.
    if (typeof entry === 'function') {
      return await new Promise((resolve) => {
        try {
          const ret = entry((err: unknown, dict: any) => resolve(err ? null : dict ?? null));
          if (ret && typeof ret.then === 'function') {
            ret.then((dict: any) => resolve(dict ?? null)).catch(() => resolve(null));
          }
        } catch {
          resolve(null);
        }
      });
    }
  } catch {
    // module not installed / incompatible — disable spellcheck
  }
  return null;
}

export async function getSpeller(): Promise<Speller | null> {
  if (!spellerPromise) {
    spellerPromise = (async () => {
      const dict = await loadDictionary();
      if (!dict) return null;
      try {
        return nspell(dict as never) as unknown as Speller;
      } catch {
        return null;
      }
    })();
  }
  return spellerPromise;
}
