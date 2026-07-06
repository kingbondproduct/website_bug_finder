import { describe, expect, it } from 'vitest';
import { categorize } from '../src/crawler/categorize.js';
import { BUG_CATEGORIES, SEVERITIES } from '@bugfinder/shared';

describe('Bug Categorization Engine', () => {
  it('maps server-side failures to Server Error', () => {
    expect(categorize({ type: 'http-5xx' })).toEqual({ category: 'Server Error', severity: 'Critical' });
    expect(categorize({ type: 'failed-request' }).category).toBe('Server Error');
    expect(categorize({ type: 'js-exception' }).category).toBe('Server Error');
  });

  it('maps 404s and bad redirects to Broken Link', () => {
    expect(categorize({ type: 'page-404' })).toEqual({ category: 'Broken Link', severity: 'High' });
    expect(categorize({ type: 'broken-link' }).category).toBe('Broken Link');
    expect(categorize({ type: 'bad-redirect' }).category).toBe('Broken Link');
  });

  it('maps broken images to Visual Bug', () => {
    expect(categorize({ type: 'broken-image' })).toEqual({ category: 'Visual Bug', severity: 'Medium' });
  });

  it('maps placeholder/spelling to Copy Issue', () => {
    expect(categorize({ type: 'placeholder-text' })).toEqual({ category: 'Copy Issue', severity: 'High' });
    expect(categorize({ type: 'spelling' })).toEqual({ category: 'Copy Issue', severity: 'Low' });
  });

  it('maps slow loads to Performance Bottleneck', () => {
    expect(categorize({ type: 'slow-load' }).category).toBe('Performance Bottleneck');
  });

  it('always returns a valid category + severity, even for unknown types', () => {
    const result = categorize({ type: 'totally-unknown-xyz' });
    expect(BUG_CATEGORIES).toContain(result.category);
    expect(SEVERITIES).toContain(result.severity);
  });
});
