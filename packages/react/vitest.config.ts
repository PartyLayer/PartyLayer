import { defineConfig } from 'vitest/config';

// The React components (e.g. modal.tsx) use the automatic JSX runtime (no
// `import React`). Enable esbuild's automatic JSX so component tests can import
// them. Environment stays `node` (matching the repo default); tests that need a
// DOM opt in per-file via `// @vitest-environment jsdom`.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
  },
});
