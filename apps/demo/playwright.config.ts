import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke tests for PartyLayer demo app
 *
 * These tests validate basic functionality without requiring
 * real wallet extensions to be installed.
 */

// ─── Port selection ─────────────────────────────────────────────────────────
//
// The port used to be the literal 3000 in three places: `use.baseURL`,
// `webServer.url`, and implicitly in `next dev`. That made the whole suite
// unrunnable on any machine already using 3000, which blocked the gate's
// verify stage on two consecutive pull requests, and it was worse than a
// blocked run: with `reuseExistingServer` true (the local default, since CI is
// unset) Playwright would happily REUSE whatever was already answering on
// 3000, so the suite could assert against an entirely unrelated application.
//
// Resolution order:
//   1. PLAYWRIGHT_PORT, then PORT, when set. Explicit wins, and if that port is
//      taken we fail with a message naming it rather than silently moving.
//   2. 3000 when it is free. CI has it free, so CI behaviour is unchanged.
//   3. Otherwise any free port the OS hands out, so the suite runs with no
//      setup on a machine that is already using 3000.

const DEFAULT_PORT = 3000;

/** Run a short node script and return its stdout, or null if it exited non-zero. */
function nodeEval(script: string): string | null {
  try {
    return execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Whether `port` can be bound. Checked on both stacks: a server bound to the
 * IPv6 wildcard also occupies the IPv4 port on most hosts, and checking only
 * one stack reports a busy port as free.
 */
function isPortFree(port: number): boolean {
  return (
    nodeEval(`
      const net = require('net');
      let left = 2;
      const done = () => { if (--left === 0) process.exit(0); };
      for (const host of ['127.0.0.1', '::']) {
        const s = net.createServer();
        s.once('error', () => process.exit(1));
        s.once('listening', () => s.close(done));
        s.listen(${port}, host);
      }
    `) !== null
  );
}

/** A port the OS says is free right now. */
function anyFreePort(): number {
  const out = nodeEval(`
    const s = require('net').createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => console.log(p));
    });
  `);
  const port = Number((out ?? '').trim());
  if (!Number.isInteger(port) || port < 1) {
    throw new Error(
      'Could not obtain a free port from the OS for the Playwright web server. ' +
        'Set PLAYWRIGHT_PORT=<port> to choose one explicitly.',
    );
  }
  return port;
}

/**
 * Internal handoff from the main process to the workers.
 *
 * Playwright re-evaluates this config file in every worker process, so a naive
 * resolver runs once per worker and each one picks a DIFFERENT port: the server
 * starts on the port the main process chose while the workers navigate to ports
 * nothing is listening on. Resolving once and passing the answer down through
 * the environment (workers inherit it) keeps every process agreed on one value.
 *
 * Deliberately distinct from PLAYWRIGHT_PORT: once our own server is up, the
 * chosen port IS occupied, so a worker re-running the "is it free" check on a
 * user-requested port would fail on our own server.
 */
const RESOLVED_PORT_ENV = 'PLAYWRIGHT_RESOLVED_PORT';

function resolvePort(): number {
  const alreadyResolved = process.env[RESOLVED_PORT_ENV];
  if (alreadyResolved) {
    const port = Number(alreadyResolved);
    if (Number.isInteger(port) && port > 0) return port;
  }

  const requested = process.env.PLAYWRIGHT_PORT ?? process.env.PORT;
  let port: number;

  if (requested) {
    port = Number(requested);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(
        `Invalid port "${requested}". Set PLAYWRIGHT_PORT to an integer between 1 and 65535, or unset it to choose one automatically.`,
      );
    }
    if (!isPortFree(port)) {
      const source = process.env.PLAYWRIGHT_PORT ? 'PLAYWRIGHT_PORT' : 'PORT';
      throw new Error(
        `Port ${port} is already in use, so the Playwright web server cannot start.\n` +
          `  That port was requested explicitly via ${source}, so no other port was chosen for you.\n` +
          `  Free port ${port}, choose another with PLAYWRIGHT_PORT=<port>, or unset ${source} to let the suite pick a free port itself.`,
      );
    }
  } else if (isPortFree(DEFAULT_PORT)) {
    port = DEFAULT_PORT;
  } else {
    port = anyFreePort();
    // eslint-disable-next-line no-console
    console.log(
      `[playwright] port ${DEFAULT_PORT} is in use, serving the demo on ${port} instead. ` +
        `Override with PLAYWRIGHT_PORT=<port>.`,
    );
  }

  process.env[RESOLVED_PORT_ENV] = String(port);
  return port;
}

const PORT = resolvePort();
const BASE_URL = `http://localhost:${PORT}`;

/** Exported so specs can reach the server without hardcoding a port. */
export { BASE_URL, PORT };

export default defineConfig({
  testDir: './e2e',
  // Real-wallet integration specs (*.e2e.spec.ts) run only via their own config
  // (playwright.walley.config.ts) — they need a real wallet + secret, so they're
  // excluded from the default mock-based run.
  testIgnore: '**/*.e2e.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // PORT is what `next dev` reads, so the server and the tests agree on one
    // value resolved in a single place.
    command: `PORT=${PORT} pnpm dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
