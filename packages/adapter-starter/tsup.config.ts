import { defineConfig } from 'tsup';

// Same build as every other adapter in this repo, so the starter stays a faithful template
// of how an adapter is built here. It emits dist/index.js (cjs), dist/index.mjs (esm) and
// dist/index.d.ts, which is exactly what the exports map names.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['@partylayer/core'],
});
