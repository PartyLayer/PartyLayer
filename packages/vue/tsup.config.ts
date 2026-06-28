import { defineConfig } from 'tsup';

export default defineConfig({
  // Pinia is on a separate subpath entry (src/pinia.ts) so `pinia` stays out of the
  // main bundle: consumers who do not use Pinia import '.' and never resolve `pinia`.
  // pinia.ts imports only external deps (pinia/vue/session types), so the two entries
  // share no internal code (no cross-bundle duplication).
  entry: ['src/index.ts', 'src/pinia.ts'],
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
  external: ['vue', 'pinia', '@partylayer/session', '@partylayer/core'],
});
