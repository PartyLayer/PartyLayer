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
  external: [
    '@partylayer/core',
    '@partylayer/registry-client',
    '@partylayer/adapter-console',
    '@partylayer/adapter-loop',
    '@partylayer/adapter-cantor8',
    '@partylayer/adapter-bron',
    '@partylayer/adapter-nightly',
    '@partylayer/adapter-send',
  ],
});
