// @vitest-environment node
/**
 * The SSR guard. Pinned to `node` by the docblock because the rest of the
 * package runs under jsdom, where `window` always exists and this branch is
 * unreachable. Expressed as an environment rather than an `if (!isBrowser)`
 * inside the body — that conditional is exactly what made the original test
 * assert nothing about the path that actually ships.
 */
import { describe, it, expect } from 'vitest';
import { LoopAdapter } from './loop-adapter';

describe('LoopAdapter: SSR (no window)', () => {
  it('reports not-installed instead of throwing', async () => {
    expect(typeof window).toBe('undefined');
    const result = await new LoopAdapter().detectInstalled();
    expect(result.installed).toBe(false);
    // Distinct from `no-local-install`: we could not probe, rather than having
    // established there is nothing to probe.
    expect(result.availability?.kind).toBe('unknown');
    expect(result.reason).toBeDefined();
  });
});
