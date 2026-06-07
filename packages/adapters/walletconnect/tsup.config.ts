import { defineConfig } from 'tsup';

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
  // @canton-network/dapp-sdk is loaded via dynamic import() at connect time and
  // MUST stay external (never inlined) so importing this package's entry does
  // not eagerly pull dapp-sdk / @walletconnect/sign-client into a consumer's
  // module graph.
  external: ['@partylayer/core', '@canton-network/dapp-sdk'],
});
