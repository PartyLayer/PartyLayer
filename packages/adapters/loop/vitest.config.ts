import { defineConfig } from 'vitest/config';

// jsdom, not node: the adapter's browser path is the one that ships, and under
// `environment: 'node'` every assertion about it was either skipped or sat
// behind an `if (!isBrowser)` that made it vacuous. See gate:test-skips.
export default defineConfig({ test: { globals: true, environment: 'jsdom' } });
