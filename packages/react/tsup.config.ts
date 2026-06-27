import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/query.ts'],
  format: ['cjs', 'esm'],
  // Mark the published bundles as client modules so importing @partylayer/react
  // (and /query) into a Server Component gives a correct client boundary instead
  // of a silent break. @partylayer/react is a client bindings package (hooks plus
  // JSX); a Server Component that needs pure types imports them from the RSC-safe
  // @partylayer/core, or via `import type` (erased at compile time).
  //
  // The directive is applied as a raw banner (prepended after esbuild), so the
  // bundler's module-directive stripping does not remove it. treeshake is off
  // because tsup's Rollup tree-shake pass would strip a leading "use client" as a
  // module directive; esbuild's own bundling still tree-shakes, so the dist shape,
  // file names, and exports are identical to before. Only the directive is added.
  banner: { js: '"use client";' },
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: false,
  external: [
    'react',
    '@tanstack/react-query',
    '@partylayer/sdk',
    '@partylayer/registry-client',
    'qrcode',
  ],
});
