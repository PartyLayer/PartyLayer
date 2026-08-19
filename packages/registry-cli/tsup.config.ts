import { defineConfig } from 'tsup';

// The previous build was two `tsc` passes that emitted ESM with extensionless relative
// specifiers, which Node cannot resolve, so the CLI could not start. tsup bundles the
// entry, so there are no unresolvable relative imports left. The package stays `type:
// module`, which makes tsup emit ESM as `dist/index.js`, keeping the existing `bin` and
// `main` targets exactly as they are.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
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
  shims: false,
});
