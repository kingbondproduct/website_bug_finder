import { DEFAULT_ROOT_DOMAIN } from '@bugfinder/shared';

/** True for a syntactically valid http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True if the URL's host is atherenergy.com (or a subdomain). */
export function isAtherUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === 'atherenergy.com' || host.endsWith('.atherenergy.com');
  } catch {
    return false;
  }
}

/** Repo slug used to build the GitHub Actions deep-link (overridable at build time). */
export const GH_REPO: string = import.meta.env.VITE_GH_REPO ?? 'kingbondproduct/website_bug_finder';

/** Link to the "Publish" workflow's dispatch page (GitHub can't pre-fill inputs). */
export function actionsDispatchUrl(repo: string = GH_REPO): string {
  return `https://github.com/${repo}/actions/workflows/publish.yml`;
}

export { DEFAULT_ROOT_DOMAIN };
