import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entrypoints: the headless "." and the "./ui" components. Splitting is on so
  // the modules both share (theme, icons, hooks) live in one shared chunk rather than
  // being inlined into each bundle, mirroring how @partylayer/react handles /query.
  entry: ['src/index.ts', 'src/ui.ts', 'src/async-storage.ts'],
  format: ['cjs', 'esm'],
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
    '@partylayer/sdk',
    '@partylayer/session',
  ],
});
