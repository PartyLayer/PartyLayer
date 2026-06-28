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
  // module directive; esbuild's own bundling still tree-shakes. The banner is
  // applied to every emitted file, so each entry AND every shared chunk starts
  // with "use client" and RSC safety holds across all of them.
  banner: { js: '"use client";' },
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  clean: true,
  sourcemap: true,
  // Splitting is on so the modules shared by both entrypoints (context.tsx,
  // hooks.ts, etc.) live in ONE shared chunk that index and query both import,
  // instead of being inlined separately into each bundle. With splitting off,
  // PartyLayerContext was duplicated across index and query, so a provider from
  // '.' and a usePartyLayer-based hook from '/query' used different React context
  // instances and never matched (the hooks threw "must be used within
  // PartyLayerProvider" for real consumers). One shared chunk means one context.
  splitting: true,
  treeshake: false,
  external: [
    'react',
    '@tanstack/react-query',
    '@partylayer/sdk',
    '@partylayer/registry-client',
    'qrcode',
  ],
});
