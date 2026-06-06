/**
 * Meta-test: the default-config mock wallet passes the SAME conformance suite
 * the repo gate runs against the native provider
 * (`runCIP0103ConformanceTests`). This is the contract that lets every
 * downstream package test against the mock with confidence.
 *
 * The runner is imported from the built conformance-runner output. `pnpm gate`
 * builds all @partylayer/* before running tests, so the dist exists; run
 * `pnpm --filter @partylayer/conformance-runner build` first if running this
 * file in isolation.
 */

import { describe, it, expect } from 'vitest';
// Deep import: @partylayer/conformance-runner exposes the runner from this
// module (its package "main" is the CLI, which we do not want to execute).
import { runCIP0103ConformanceTests } from '@partylayer/conformance-runner/dist/cip0103-tests.js';
import { createMockWallet } from '../mock-wallet';

describe('mock wallet conformance', () => {
  it('default config passes runCIP0103ConformanceTests with zero failures', async () => {
    const provider = createMockWallet();
    const report = await runCIP0103ConformanceTests(provider);

    if (report.failed > 0) {
      const failures = report.results
        .filter((r) => !r.passed)
        .map((r) => `  ✗ ${r.name}${r.error ? ` — ${r.error}` : ''}`)
        .join('\n');
      throw new Error(`Mock wallet failed ${report.failed} conformance check(s):\n${failures}`);
    }

    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
    expect(report.total).toBeGreaterThan(0);
  });

  it('a connected mock also passes conformance', async () => {
    const provider = createMockWallet({ connected: true });
    const report = await runCIP0103ConformanceTests(provider);
    expect(report.failed).toBe(0);
  });
});
