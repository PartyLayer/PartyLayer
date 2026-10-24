import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/authentication.ts', 'src/amounts.ts'],
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
});
