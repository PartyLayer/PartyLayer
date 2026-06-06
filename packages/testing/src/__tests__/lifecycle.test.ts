/**
 * Meta-tests: the simulated transaction lifecycle transitions correctly in
 * both manual and auto modes, and emits the CIP-0103 txChanged events.
 */

import { describe, it, expect, vi } from 'vitest';
import type { CIP0103TxChangedEvent } from '@partylayer/core';
import { createTransactionLifecycle } from '../lifecycle';
import { createMockWallet } from '../mock-wallet';
import { recordTxEvents } from '../offline';

function collect(lc: ReturnType<typeof createTransactionLifecycle>) {
  const events: CIP0103TxChangedEvent[] = [];
  lc.on('txChanged', (e) => events.push(e));
  return events;
}

describe('createTransactionLifecycle — manual stepping', () => {
  it('walks idle → preparing → submitting → confirming → finalized', () => {
    const lc = createTransactionLifecycle({ commandId: 'cmd-1' });
    expect(lc.phase).toBe('idle');

    expect(lc.advance()).toBe('preparing');
    expect(lc.isPreparing).toBe(true);

    expect(lc.advance()).toBe('submitting');
    expect(lc.isSubmitting).toBe(true);

    expect(lc.advance()).toBe('confirming');
    expect(lc.isConfirming).toBe(true);

    expect(lc.advance()).toBe('finalized');
    expect(lc.isFinalized).toBe(true);

    // terminal: further advances are no-ops
    expect(lc.advance()).toBe('finalized');
  });

  it('emits pending → signed → executed (confirming emits nothing)', () => {
    const lc = createTransactionLifecycle({
      commandId: 'cmd-7',
      party: 'party::x',
      signature: 'sig-x',
      updateId: 'upd-x',
    });
    const events = collect(lc);

    lc.advance(); // preparing → pending
    lc.advance(); // submitting → signed
    lc.advance(); // confirming → (no event)
    lc.advance(); // finalized → executed

    expect(events.map((e) => e.status)).toEqual(['pending', 'signed', 'executed']);

    const signed = events[1];
    expect(signed.status === 'signed' && signed.payload.signature).toBe('sig-x');
    expect(signed.status === 'signed' && signed.payload.party).toBe('party::x');

    const executed = events[2];
    expect(executed.status === 'executed' && executed.payload.updateId).toBe('upd-x');
    expect(executed.status === 'executed' && executed.payload.completionOffset).toBe(0);

    // every event carries the same commandId
    expect(events.every((e) => e.commandId === 'cmd-7')).toBe(true);
  });

  it('fail() emits a failed terminal and blocks further advance', () => {
    const lc = createTransactionLifecycle({ commandId: 'cmd-f' });
    const events = collect(lc);

    lc.advance(); // preparing
    lc.advance(); // submitting
    lc.fail();

    expect(lc.isFailed).toBe(true);
    expect(lc.phase).toBe('failed');
    expect(events.map((e) => e.status)).toEqual(['pending', 'signed', 'failed']);

    // no further transitions
    expect(lc.advance()).toBe('failed');
    expect(events.map((e) => e.status)).toEqual(['pending', 'signed', 'failed']);
  });

  it('reset() returns to idle', () => {
    const lc = createTransactionLifecycle();
    lc.advance();
    lc.advance();
    lc.reset();
    expect(lc.phase).toBe('idle');
    expect(lc.isSubmitting).toBe(false);
  });

  it('on() returns an unsubscribe that stops further delivery', () => {
    const lc = createTransactionLifecycle();
    const events: CIP0103TxChangedEvent[] = [];
    const off = lc.on('txChanged', (e) => events.push(e));
    lc.advance(); // pending
    off();
    lc.advance(); // signed — not delivered
    expect(events.map((e) => e.status)).toEqual(['pending']);
  });
});

describe('createTransactionLifecycle — auto mode', () => {
  it('start() walks all phases using configured delays (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const lc = createTransactionLifecycle({
        delays: { preparing: 10, submitting: 10, confirming: 10, finalized: 10 },
      });
      const events = collect(lc);
      const done = lc.start();

      // nothing has fired before time advances
      expect(lc.phase).toBe('idle');

      await vi.advanceTimersByTimeAsync(40);
      await done;

      expect(lc.phase).toBe('finalized');
      expect(events.map((e) => e.status)).toEqual(['pending', 'signed', 'executed']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('start() with zero delays completes synchronously-ish on the microtask queue', async () => {
    const lc = createTransactionLifecycle();
    await lc.start();
    expect(lc.phase).toBe('finalized');
  });
});

describe('createTransactionLifecycle — provider mirroring', () => {
  it('mirrors txChanged onto a linked provider bus', () => {
    const provider = createMockWallet();
    const rec = recordTxEvents(provider);
    const lc = createTransactionLifecycle({ provider, commandId: 'cmd-m' });

    lc.advance(); // pending
    lc.advance(); // signed
    lc.advance(); // confirming (no event)
    lc.advance(); // executed

    expect(rec.statuses()).toEqual(['pending', 'signed', 'executed']);
    rec.stop();
  });
});
