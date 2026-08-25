/**
 * The two properties that make one shared set worth having:
 *
 *  - a wallet added to the shared set appears in EVERY consuming app, so adding
 *    one is a single edit rather than three;
 *  - an app that opts out does not get it, so a deliberate divergence stays
 *    deliberate and does not leak into the other surfaces.
 *
 * Both are asserted against the real builder with the real adapter classes. The
 * builder only constructs adapter objects, it never opens a connection or
 * touches the network, so this runs offline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWalletAdapters,
  SHARED_WALLET_KEYS,
  type AdapterEntry,
  type SharedAdapterOptions,
  type WalletKey,
} from './index.js';

/** How each consuming app calls the builder, minus anything app-specific. */
const BASE: SharedAdapterOptions = { network: 'devnet', walletConnectProjectId: 'test-project-id' };

/** The id an entry will register under, whichever form it takes. */
function idOf(entry: AdapterEntry): string {
  const e = entry as { walletId?: unknown; providerId?: unknown };
  return String(e.walletId ?? e.providerId ?? '');
}

function idsFor(opts: Partial<SharedAdapterOptions> = {}): string[] {
  return buildWalletAdapters({ ...BASE, ...opts }).map(idOf);
}

test('the shared set is what every app gets: same wallets, same order, for identical options', () => {
  // Three apps calling with the same options must receive the same set. This is
  // the property that stopped the three hand-maintained lists from drifting.
  const a = idsFor();
  const b = idsFor();
  assert.deepEqual(a, b);

  // Order is the declaration order of SHARED_WALLET_KEYS, minus wallets that
  // need configuration they were not given (Bron). No sort is imposed here:
  // apps/demo applies its own, the two verticals use the modal default.
  const expected = SHARED_WALLET_KEYS.filter((k) => k !== 'bron');
  assert.deepEqual(a, [...expected]);
});

test('ADDING a wallet to the shared set surfaces it in every consuming app', () => {
  // The registry-driven wallets each app must carry. If a key is added to
  // SHARED_WALLET_KEYS, every app that does not exclude it gets it, which is
  // what this asserts: no app-side edit is needed for it to appear.
  for (const key of SHARED_WALLET_KEYS) {
    if (key === 'bron') continue; // needs config; covered separately below
    const built = idsFor();
    assert.ok(
      built.includes(key),
      `"${key}" is in the shared set but did not reach a consuming app's list`,
    );
  }

  // Same assertion from the app side: the demo's options and a vertical's
  // options differ only in what they pass, never in which wallets exist.
  const demoLike = idsFor({ exclude: ['console', 'send'] });
  const verticalLike = idsFor({ bron: undefined });
  for (const key of SHARED_WALLET_KEYS) {
    if (key === 'bron' || key === 'console' || key === 'send') continue;
    assert.ok(demoLike.includes(key), `demo-like app missing "${key}"`);
    assert.ok(verticalLike.includes(key), `vertical-like app missing "${key}"`);
  }
});

test('an app that OPTS OUT does not get the excluded wallets, and no others are affected', () => {
  // apps/demo excludes console and send: it receives both over the CIP-0103
  // announce transport and registering explicit adapters would change how it
  // connects them.
  const excluded: WalletKey[] = ['console', 'send'];
  const withOptOut = idsFor({ exclude: excluded });

  for (const key of excluded) {
    assert.ok(!withOptOut.includes(key), `"${key}" was excluded but still registered`);
  }

  // Excluding must remove exactly those and nothing else.
  const full = idsFor();
  assert.deepEqual(
    full.filter((id) => !excluded.includes(id as WalletKey)),
    withOptOut,
  );
});

test('an unconfigured wallet is omitted, which is not the same as being excluded', () => {
  // Bron needs real OAuth credentials. Without config it is not registered, so
  // the SDK hides it rather than showing a wallet whose click would dead-end.
  assert.ok(!idsFor().includes('bron'), 'Bron must not register without config');

  const configured = idsFor({
    bron: {
      auth: {
        authorizationUrl: 'https://auth.example/authorize',
        tokenUrl: 'https://auth.example/token',
        clientId: 'test-client',
        redirectUri: 'https://app.example/callback',
        usePKCE: true,
      },
      api: { baseUrl: 'https://api.example' },
    },
  });
  assert.ok(configured.includes('bron'), 'Bron must register once configured');
});

test('no wallet host is hardcoded: the discovery wallets are registered as factories', () => {
  // Walley and Cauri carry networkHosts in their registry entries. Registering
  // them in factory form is what lets the SDK resolve the host per network, and
  // is why no wallet URL appears in the shared module or in any app.
  for (const id of ['walley', 'cauri', 'oneswap']) {
    const entry = buildWalletAdapters(BASE).find((e) => idOf(e) === id);
    assert.ok(entry, `${id} should be registered`);
    assert.equal(
      typeof (entry as { create?: unknown }).create,
      'function',
      `${id} must be a factory so its host comes from the registry, not app code`,
    );
  }
});
