import { defineConfig } from 'tsup';

// The previous build was two `tsc` passes that emitted ESM with extensionless relative
// specifiers, which Node cannot resolve, so the CLI could not start. tsup bundles the
// entry, so there are no unresolvable relative imports left. The package stays `type:
// module`, which makes tsup emit ESM as `dist/index.js`, keeping the existing `bin` and
// `main` targets exactly as they are.
export default defineConfig({
  // Two entries. `index` is the CLI. `cip0103-tests` is a second entry point that the
  // react, vue and testing conformance suites deep import as
  // `@partylayer/conformance-runner/dist/cip0103-tests`, and the gate's
  // conformance-native script reads the same file, so it has to keep existing.
  entry: ['src/index.ts', 'src/cip0103-tests.ts'],
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
