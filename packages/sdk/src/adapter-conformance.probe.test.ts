// @vitest-environment jsdom
/**
 * RULE 2 of the availability contract: a wallet claiming `installed` must have
 * PROBED something.
 *
 * Operational definition: withdraw the evidence and the answer must change. An
 * adapter that answers `installed` regardless of what the page looks like has
 * not probed, it has asserted — which is how eight of twelve adapters came to
 * report a wallet as ready when they had only established that a browser exists.
 *
 * Pinned to jsdom by the docblock because it needs a real `window` to add and
 * remove a global from. That is a fixture, not a runtime branch.
 */
import { describe, it, expect } from 'vitest';
import { NightlyAdapter } from '@partylayer/adapter-nightly';

describe('Adapter conformance: installed means probed', () => {
  it('Nightly changes its answer when the evidence is withdrawn', async () => {
    const adapter = new NightlyAdapter();

    (window as unknown as { nightly?: unknown }).nightly = { canton: {} };
    const withEvidence = await adapter.detectInstalled();
    expect(withEvidence.availability?.kind).toBe('installed');
    expect(withEvidence.installed).toBe(true);

    delete (window as unknown as { nightly?: unknown }).nightly;
    const withoutEvidence = await adapter.detectInstalled();

    expect(
      withoutEvidence.availability?.kind,
      'removing the evidence must change the answer - otherwise nothing was probed',
    ).not.toBe('installed');
    expect(withoutEvidence.installed).toBe(false);
    expect(withoutEvidence.availability?.kind).toBe('not-installed');
  });
});
