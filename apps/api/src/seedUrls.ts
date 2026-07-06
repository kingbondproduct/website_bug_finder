// The canonical Ather seed URLs live in the shared package so the dashboard's
// URL pickers can reuse them without a fetch. Re-exported here to keep the
// existing server-side import path (`./seedUrls.js`) stable.
export { ATHER_SEED_URLS, DEFAULT_ROOT_DOMAIN } from '@bugfinder/shared';
