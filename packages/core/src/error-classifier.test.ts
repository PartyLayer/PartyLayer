/**
 * Regression tests for the error classifier (D2 + D3).
 *
 * Both defects live in `mapUnknownErrorToPartyLayerError`:
 *
 *  D3 — a substring scan for "rejected" collapsed every wallet-side refusal
 *       into USER_REJECTED. Observed live: Nightly refused because the tab was
 *       not focused ("Connect request rejected - tab is not active") and the
 *       dApp was told the user had cancelled, though no prompt was ever shown.
 *
 *  D2 — the timeout branch preferred `context.timeoutMs` over the real number
 *       already present in the rejection message, so a 120 000 ms deadline was
 *       reported as "30000ms"; with no context at all it reported "0ms".
 */
import { describe, it, expect } from 'vitest';
import {
  mapUnknownErrorToPartyLayerError,
  UserRejectedError,
  WalletRefusedError,
  TimeoutError,
} from './errors';

const connectCtx = { phase: 'connect' as const, walletId: 'nightly' };

describe('D3: a wallet-side refusal is not a user cancellation', () => {
  it('does NOT report Nightly\'s focus refusal as USER_REJECTED', () => {
    // The exact string observed in the browser run.
    const err = new Error('Connect request rejected - tab is not active');
    const mapped = mapUnknownErrorToPartyLayerError(err, connectCtx);

    expect(mapped.code).not.toBe('USER_REJECTED');
    expect(mapped).toBeInstanceOf(WalletRefusedError);
    expect(mapped.code).toBe('WALLET_REFUSED');
  });

  it('surfaces the wallet\'s own words in the message, not a generic one', () => {
    const err = new Error('Connect request rejected - tab is not active');
    const mapped = mapUnknownErrorToPartyLayerError(err, connectCtx);

    expect(mapped.message).toContain('tab is not active');
    expect(mapped.details?.originalMessage).toBe(
      'Connect request rejected - tab is not active',
    );
  });

  it('still reports a REAL user cancellation as USER_REJECTED, by structured signal', () => {
    // EIP-1193 4001 is the unambiguous "user rejected request" code.
    const err = Object.assign(new Error('User rejected the request'), { code: 4001 });
    const mapped = mapUnknownErrorToPartyLayerError(err, connectCtx);

    expect(mapped).toBeInstanceOf(UserRejectedError);
    expect(mapped.code).toBe('USER_REJECTED');
  });

  it('honours an adapter-thrown UserRejectedError by name', () => {
    const err = Object.assign(new Error('nope'), { name: 'UserRejectedError' });
    expect(mapUnknownErrorToPartyLayerError(err, connectCtx).code).toBe('USER_REJECTED');
  });

  it('does not misclassify a permissions failure as a user cancellation', () => {
    const err = new Error('Permission denied: origin not allowlisted');
    const mapped = mapUnknownErrorToPartyLayerError(err, connectCtx);
    expect(mapped.code).not.toBe('USER_REJECTED');
  });
});

describe('D2: the reported deadline is the one that actually elapsed', () => {
  it('keeps the number the timeout itself reported, over a disagreeing context', () => {
    // What client.ts actually rejects with when its 120s race fires…
    const err = new Error(
      'Connection timed out after 120000ms - user did not complete wallet connection',
    );
    // …mapped with a context that carries a DIFFERENT number (the old 30000 default).
    const mapped = mapUnknownErrorToPartyLayerError(err, {
      ...connectCtx,
      timeoutMs: 30000,
    });

    expect(mapped).toBeInstanceOf(TimeoutError);
    expect(mapped.message).toContain('120000ms');
    expect(mapped.message).not.toContain('30000ms');
    expect(mapped.details?.timeoutMs).toBe(120000);
  });

  it('never reports a literal 0ms deadline', () => {
    // Cantor8's SDK message carries no number and passes no context.timeoutMs.
    const err = new Error('Request timed out');
    const mapped = mapUnknownErrorToPartyLayerError(err, {
      phase: 'connect',
      walletId: 'cantor8',
      transport: 'popup',
    });

    expect(mapped.code).toBe('TIMEOUT');
    expect(mapped.message).not.toContain('0ms');
    expect(mapped.details?.timeoutMs).not.toBe(0);
  });

  it('falls back to context when the message carries no number', () => {
    const err = new Error('Request timed out');
    const mapped = mapUnknownErrorToPartyLayerError(err, {
      ...connectCtx,
      timeoutMs: 45000,
    });
    expect(mapped.details?.timeoutMs).toBe(45000);
    expect(mapped.message).toContain('45000ms');
  });
});
