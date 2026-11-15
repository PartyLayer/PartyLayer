import { defineConfig } from 'tsup';

export default defineConfig({
  // Native headless/UI/storage and the explicit web entry share common chunks.
  // The web factory alone keeps the optional browser SDK external.
  entry: ['src/index.ts', 'src/ui.ts', 'src/async-storage.ts', 'src/web.ts'],
  format: ['cjs', 'esm'],
  // The relative sdk-native facade bundles only our own shared source and declarations.
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  // Peers stay external so nothing pulls react-native or react-native-svg into a bundle.
  external: [
    'react',
    'react-native',
    'react-native-svg',
    '@react-native-async-storage/async-storage',
    '@partylayer/core',
    '@partylayer/provider',
    '@partylayer/registry-client',
    '@partylayer/sdk',
    '@partylayer/session',
  ],
});
