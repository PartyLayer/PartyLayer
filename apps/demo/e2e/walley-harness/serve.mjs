/**
 * TEST-ONLY: bundle + serve the Walley E2E harness with esbuild.
 *
 * Run only by the Playwright walley webServer. No Vite, no Next, no prod build —
 * this never touches the production bundle or the live demo. Serves the harness
 * (index.html + the bundled entry) on a local port.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.WALLEY_HARNESS_PORT || 5273);

const ctx = await esbuild.context({
  entryPoints: [resolve(here, 'main.tsx')],
  bundle: true,
  outfile: resolve(here, 'bundle.js'),
  format: 'esm',
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    // The import graph (PartyLayerKit → builtin adapters → @console-wallet/dapp-sdk)
    // pulls in icon/image assets we never render in this Walley-only harness.
    // Inline them as data URLs so esbuild can bundle without an asset pipeline.
    '.png': 'dataurl',
    '.svg': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.webp': 'dataurl',
    '.css': 'text',
  },
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'info',
});

await ctx.rebuild();
const server = await ctx.serve({ servedir: here, host: '127.0.0.1', port });
// eslint-disable-next-line no-console
console.log(`[walley-harness] serving on http://127.0.0.1:${server.port}`);
