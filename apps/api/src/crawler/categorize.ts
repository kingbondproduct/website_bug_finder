import type { BugCategory, RawFinding, Severity } from '@bugfinder/shared';

export interface CategorizedBug {
  category: BugCategory;
  severity: Severity;
}

/**
 * Bug Categorization Engine.
 *
 * Maps a raw finding's machine `type` onto the strict 5-way QA taxonomy and a
 * severity. This is the single source of truth for classification — every check
 * emits a `type` string and this table decides the rest.
 */
const RULES: Record<string, CategorizedBug> = {
  // --- Server Error ---
  'http-5xx': { category: 'Server Error', severity: 'Critical' },
  'failed-request': { category: 'Server Error', severity: 'High' },
  'js-exception': { category: 'Server Error', severity: 'High' },
  'console-error': { category: 'Server Error', severity: 'Medium' },

  // --- Broken Link ---
  'page-404': { category: 'Broken Link', severity: 'High' },
  'broken-link': { category: 'Broken Link', severity: 'Medium' },
  'bad-redirect': { category: 'Broken Link', severity: 'Medium' },

  // --- Visual Bug ---
  'broken-image': { category: 'Visual Bug', severity: 'Medium' },

  // --- Copy Issue ---
  'placeholder-text': { category: 'Copy Issue', severity: 'High' },
  spelling: { category: 'Copy Issue', severity: 'Low' },

  // --- Performance Bottleneck ---
  'slow-load': { category: 'Performance Bottleneck', severity: 'Medium' },
};

const FALLBACK: CategorizedBug = { category: 'Server Error', severity: 'Low' };

export function categorize(finding: Pick<RawFinding, 'type'>): CategorizedBug {
  return RULES[finding.type] ?? FALLBACK;
}

/** Exposed for tests / documentation. */
export const CATEGORIZATION_RULES = RULES;
