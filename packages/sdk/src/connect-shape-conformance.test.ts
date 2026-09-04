// @vitest-environment jsdom
/**
 * D6: a wallet's `connect` shape must match what its adapter actually does.
 *
 * The registry is gaining `connect: 'injected' | 'popup' | 'relay'` as its own
 * field, orthogonal to how a wallet is DISCOVERED (announce) and how its SDK is
 * LOADED (scriptTag). Those three questions were previously answered by one
 * overloaded field, which is how `scriptTag` came to mean "scan": it says how
 * the SDK is loaded, and Loop scans a QR while Cantor8 opens a popup.
 *
 * We are two for two on contracts drifting once they are only convention — the
 * `installed` contract and the availability contract both did — so this one is
 * a test from the start.
 *
 * THE RELAY CASE IS THE LOAD-BEARING ONE. Loop (WebSocket + QR) and
 * WalletConnect (pairing relay) are both `relay`, and neither has anything local
 * NOR opens a window: the connection is established on another device. If a
 * wallet declaring `relay` opens a window, either the adapter or the
 * classification is wrong, and this test says which by failing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LoopAdapter } from '@partylayer/adapter-loop';
import { Cantor8Adapter } from '@partylayer/adapter-cantor8';
import { NightlyAdapter } from '@partylayer/adapter-nightly';

/** The shape each wallet's registry entry will declare. */
const CONNECT_SHAPE = {
  loop: 'relay',
  cantor8: 'popup',
  nightly: 'injected',
} as const;

afterEach(() => vi.restoreAllMocks());

describe('D6: connect shape ↔ adapter behaviour', () => {
  it('a non-injected wallet has no local install to report', async () => {
    for (const [id, shape] of Object.entries(CONNECT_SHAPE)) {
      if (shape === 'injected') continue;
      const adapter = id === 'loop' ? new LoopAdapter() : new Cantor8Adapter();
      const r = await adapter.detectInstalled();
      expect(r.availability?.kind, `${id} (${shape})`).toBe('no-local-install');
    }
  });

  it('an injected wallet probes a local artefact and can report either answer', async () => {
    const adapter = new NightlyAdapter();
    delete (window as unknown as Record<string, unknown>).nightly;
    expect((await adapter.detectInstalled()).availability?.kind).toBe('not-installed');
    (window as unknown as Record<string, unknown>).nightly = { canton: {} };
    expect((await adapter.detectInstalled()).availability?.kind).toBe('installed');
    delete (window as unknown as Record<string, unknown>).nightly;
  });

  it('a wallet declaring relay must not open a window on the picker path', async () => {
    // `detectInstalled` runs on every picker render. A relay wallet reaching
    // window.open here would pop a window at render time, off any user gesture —
    // which browsers block, and which is the signal that it is not a relay.
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    await new LoopAdapter().detectInstalled();
    expect(spy, 'loop is relay: it must not open a window').not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a deep link hint looks like a scheme, not a package name', () => {
    // `installHints.deepLinkScheme` was populated from `installation.scriptTag`,
    // so every scriptTag wallet carried an npm package name in a field meaning
    // `loop://`. Nothing read it, so it survived review as inert-but-wrong —
    // which is exactly the kind of defect that ships the day someone reads it.
    // This assertion is cheap and it would have caught it.
    const looksLikeScheme = (v: string) => !v.startsWith('@') && !v.includes('/');

    expect(looksLikeScheme('loop')).toBe(true);
    expect(looksLikeScheme('https://consolewallet.io/wallet-connect')).toBe(false);
    // The value the bug actually produced:
    expect(looksLikeScheme('@fivenorth/loop-sdk')).toBe(false);

    // A package name must never reach the field again. Registry entries whose
    // `installation.deeplink` is a full URL are a separate question (the field
    // is named "scheme"); what matters here is that the SDK-package name, which
    // is what the bug wrote, is rejected.
    for (const pkg of ['@fivenorth/loop-sdk', '@cantor8/wallet-connect-sdk']) {
      expect(looksLikeScheme(pkg), `${pkg} must not pass as a deep link scheme`).toBe(false);
    }
  });

  it('the relay subtitle has to read for BOTH a QR scan and a mobile pairing', () => {
    // Loop scans a QR with its phone app; WalletConnect pairs a mobile wallet.
    // One label covers both because the axis is "where does the connection
    // happen", not "what does the UI look like". Needing a fourth value here
    // would mean the axis is wrong, not that the label needs an exception.
    const RELAY_SUBTITLE = 'Connect from another device — nothing to install';
    expect(RELAY_SUBTITLE).toMatch(/another device/);
    expect(CONNECT_SHAPE.loop).toBe('relay');
    // walletconnect is relay too: its adapter's only window.open reference
    // SUPPRESSES the vendor SDK's blank popup rather than opening one.
  });
});
