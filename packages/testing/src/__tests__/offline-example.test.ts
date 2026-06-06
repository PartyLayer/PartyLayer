/**
 * Meta-test + worked example: a full connect → submit → finalize flow asserted
 * entirely offline against the mock — no DevNet, no live wallet, no network.
 *
 * This is the canonical example the README points to.
 */

import { describe, it, expect, vi } from 'vitest';
import { createMockWallet } from '../mock-wallet';
import { connectMock, recordTxEvents } from '../offline';

describe('offline example — connect → submit → finalize', () => {
  it('drives the whole happy path against the mock and asserts the tx event stream', async () => {
    const provider = createMockWallet();
    const rec = recordTxEvents(provider);

    // 1. connect (offline — resolves immediately)
    const connected = await connectMock(provider);
    expect(connected.isConnected).toBe(true);

    // 2. submit a transaction via the CIP-0103 prepareExecute lifecycle
    await provider.request({ method: 'prepareExecute', params: { tx: { hello: 'world' } } });

    // 3. assert the full lifecycle was emitted
    expect(rec.statuses()).toEqual(['pending', 'signed', 'executed']);

    rec.stop();
  });

  it('is deterministic under fake timers with per-method delays', async () => {
    vi.useFakeTimers();
    try {
      const provider = createMockWallet({
        delays: { signTransaction: 100, submitTransaction: 100 },
      });
      const rec = recordTxEvents(provider);

      await connectMock(provider);
      const submit = provider.request({ method: 'prepareExecute', params: { tx: {} } });

      // 'pending' fires immediately; 'signed' waits for the signTransaction delay
      expect(rec.statuses()).toEqual(['pending']);
      await vi.advanceTimersByTimeAsync(100);
      expect(rec.statuses()).toEqual(['pending', 'signed']);
      await vi.advanceTimersByTimeAsync(100);
      await submit;
      expect(rec.statuses()).toEqual(['pending', 'signed', 'executed']);

      rec.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a mid-flight submission failure terminates the stream with failed', async () => {
    const provider = createMockWallet({
      scenarios: { submitTransaction: 'insufficientTraffic' },
    });
    const rec = recordTxEvents(provider);

    await connectMock(provider);
    await expect(
      provider.request({ method: 'prepareExecute', params: { tx: {} } }),
    ).rejects.toThrow();

    expect(rec.statuses()).toEqual(['pending', 'signed', 'failed']);
    rec.stop();
  });
});
