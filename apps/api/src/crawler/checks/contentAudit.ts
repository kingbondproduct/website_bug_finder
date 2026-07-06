import type { Page } from 'playwright';
import type { RawFinding, Viewport } from '@bugfinder/shared';
import { getSpeller } from './spellcheck.js';

// Placeholder / leaked-template patterns that should never reach production copy.
const PLACEHOLDER_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'Lorem Ipsum', re: /lorem ipsum/i },
  { label: 'unrendered template {{...}}', re: /\{\{[^}]{1,60}\}\}/ },
  { label: 'literal "undefined"', re: /(?<![A-Za-z])undefined(?![A-Za-z])/ },
  { label: 'literal "NaN"', re: /(?<![A-Za-z])NaN(?![A-Za-z])/ },
  { label: 'literal "null"', re: /(?<![A-Za-z])null(?![A-Za-z])/ },
  { label: '[object Object]', re: /\[object Object\]/ },
  { label: 'printf token %s/%d', re: /%[sd](?![A-Za-z0-9])/ },
  { label: 'TODO/FIXME marker', re: /\b(?:TODO|FIXME|PLACEHOLDER|XXX)\b/ },
];

// Words we never flag as misspellings (brand / product / domain vocabulary).
const SPELL_ALLOWLIST = new Set([
  'ather', 'rizta', 'atherstack', 'atherenergy', 'flexipay', 'ecw', 'tco', 'emi',
  'kwh', 'kmph', 'ev', 'evs', 'bengaluru', 'ola', 'ampere', 'scooters', 'scooter',
  'buyback', 'testride', 'app', 'apps', 'faq', 'faqs', 'iot', 'ui', 'ux',
]);

const MAX_SPELL_FINDINGS = 12;

export async function contentAudit(page: Page, viewport: Viewport): Promise<RawFinding[]> {
  const text: string = await page
    .evaluate(() => document.body?.innerText ?? '')
    .catch(() => '');
  if (!text.trim()) return [];

  const findings: RawFinding[] = [];

  // --- Placeholder patterns ---
  for (const { label, re } of PLACEHOLDER_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      findings.push({
        type: 'placeholder-text',
        message: `Placeholder/leaked content detected: ${label}`,
        viewport,
        evidence: { pattern: label, snippet: snippetAround(text, m.index) },
      });
    }
  }

  // --- Spellcheck (best effort, offline) ---
  const speller = await getSpeller();
  if (speller) {
    const misspelled = new Set<string>();
    const tokens = text.match(/[A-Za-z][A-Za-z'’]{3,}/g) ?? [];
    for (const raw of tokens) {
      if (misspelled.size >= MAX_SPELL_FINDINGS) break;
      const word = raw.replace(/[’']/g, "'");
      const lower = word.toLowerCase();
      if (SPELL_ALLOWLIST.has(lower)) continue;
      // Skip likely proper nouns (Capitalized mid-sentence) and ALLCAPS acronyms.
      if (/^[A-Z]/.test(word) || word === word.toUpperCase()) continue;
      if (speller.correct(word)) continue;
      if (misspelled.has(lower)) continue;
      misspelled.add(lower);
      findings.push({
        type: 'spelling',
        message: `Possible spelling issue: "${word}"`,
        viewport,
        evidence: { word },
      });
    }
  }

  return findings;
}

function snippetAround(text: string, index: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + 60);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}
