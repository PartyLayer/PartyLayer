import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', native: 'src/native.ts', 'internal/hosted-wallet-profiles': 'src/hosted-wallet-profiles.ts' },
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
  external: [
    // Preserve the package-private dynamic boundary instead of inlining the profile.
    '#partylayer-hosted-wallet-profiles',
    '@partylayer/core',
    '@partylayer/registry-client',
    '@partylayer/adapter-console',
    '@partylayer/adapter-loop',
    '@partylayer/adapter-cantor8',
    '@partylayer/adapter-bron',
    '@partylayer/adapter-nightly',
    '@partylayer/adapter-send',
    '@partylayer/adapter-walletconnect',
  ],
});
