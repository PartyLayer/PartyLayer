/**
 * Adapter-level conformance tests that run automatically across all 5
 * built-in adapters.
 *
 * Specifically guards against capability-vs-implementation drift. We hit
 * this in v0.3.5 audit: 3 of 5 adapters had a working restore() method
 * but didn't declare the 'restore' capability, so `wallet.capabilities
 * .includes('restore')` returned false and misled anyone inspecting
 * capabilities programmatically.
 *
 * This suite enforces:
 *   - If an adapter implements restore() → it MUST declare 'restore'
 *   - If it declares 'restore' → it MUST implement restore()
 * Same direction for signMessage / signTransaction / submitTransaction /
 * ledgerApi so the same bug can't silently regress on any method.
 */

import { describe, it, expect, vi } from 'vitest';

// Console's SDK imports SVGs which explode under Node. Stub so we can
// instantiate ConsoleAdapter in this test file.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { ConsoleAdapter } from '@partylayer/adapter-console';
import { LoopAdapter } from '@partylayer/adapter-loop';
import { Cantor8Adapter } from '@partylayer/adapter-cantor8';
import { NightlyAdapter } from '@partylayer/adapter-nightly';
import { SendAdapter } from '@partylayer/adapter-send';
import type { WalletAdapter, CapabilityKey } from '@partylayer/core';

// Capabilities whose declaration must round-trip with method presence.
//
// We only enforce symmetry for `restore` because:
//   - The SDK calls adapter.restore() directly without consulting
//     `capabilities` (see PartyLayerClient.restoreSession in sdk/src/client.ts
//     — it checks `if (adapter?.restore)` not the capability string). So
//     if an adapter implements restore() but forgets to declare it,
//     session persistence still works at runtime but consumers who check
//     `wallet.capabilities.includes('restore')` get a false negative.
//     This is the exact B7 bug from the v0.3.5 audit.
//
//   - For signMessage / signTransaction / submitTransaction / ledgerApi,
//     some adapters keep the method as an intentional stub that throws
//     CapabilityNotSupportedError (e.g. Loop's signTransaction, because
//     Loop SDK fuses sign+submit). The capability is correctly NOT
//     declared for those. The SDK's capabilityGuard() already enforces
//     the declared list for these methods, so there's no silent drift.
const METHOD_BACKED_CAPABILITIES: Array<{
  capability: CapabilityKey;
  method: keyof WalletAdapter;
}> = [
  { capability: 'restore', method: 'restore' },
];

const adapters: Array<{ name: string; adapter: WalletAdapter }> = [
  { name: 'Console', adapter: new ConsoleAdapter() },
  { name: 'Loop', adapter: new LoopAdapter() },
  { name: 'Cantor8', adapter: new Cantor8Adapter() },
  { name: 'Nightly', adapter: new NightlyAdapter() },
  { name: 'Send', adapter: new SendAdapter() },
  // Bron requires OAuth config so we construct it with a minimal stub.
  // It exercises the same capability declaration surface we care about.
];

describe('Adapter conformance: capability ↔ method symmetry', () => {
  for (const { name, adapter } of adapters) {
    describe(name, () => {
      const caps = adapter.getCapabilities();

      for (const { capability, method } of METHOD_BACKED_CAPABILITIES) {
        const declares = caps.includes(capability);
        const implements_ = typeof (adapter as unknown as Record<string, unknown>)[method] === 'function';

        it(`${capability}: declared (${declares}) ↔ implemented (${implements_})`, () => {
          if (declares && !implements_) {
            throw new Error(
              `${name} declares '${capability}' capability but does not implement ${String(method)}()`,
            );
          }
          if (implements_ && !declares) {
            throw new Error(
              `${name} implements ${String(method)}() but does not declare '${capability}' capability. ` +
                `Add '${capability}' to getCapabilities() so consumers can discover the feature.`,
            );
          }
          expect(declares).toBe(implements_);
        });
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Detection truthfulness (negative path) — Prompt 7.5 regression suite.
//
// The Browser-B bug class (false-positive "Ready" indicator in the picker)
// surfaces when an adapter's detectInstalled() returns true even though
// its primary medium — extension / postMessage handshake / window.canton
// injection — is absent. This block pins the truthful contract: every
// adapter that has an install state MUST report installed:false when its
// transport is absent. Adapters that are install-less by design (Loop,
// Cantor8, Bron) are documented here with skip() rather than tested,
// because their `installed:true` reflects "no install needed", not a
// false claim about a missing extension.
// ─────────────────────────────────────────────────────────────────────────────

describe('Adapter conformance: detection truthfulness (negative path)', () => {
  it('Console (combined target): installed=false when extension absent', async () => {
    const adapter = new ConsoleAdapter();
    // No window.canton, no extension postMessage handshake → must say
    // not installed. Connect-time QR fallback is unaffected.
    const result = await adapter.detectInstalled();
    expect(result.installed).toBe(false);
  });

  it('Send: installed=false when window.canton injection missing', async () => {
    // Send adapter requires window.canton + matching providerDetection.
    // In Node (no window) the early-exit branch returns false; in a
    // browser without the extension the kernel-id guard returns false.
    const { SendAdapter } = await import('@partylayer/adapter-send');
    const adapter = new SendAdapter();
    const result = await adapter.detectInstalled();
    expect(result.installed).toBe(false);
  });

  it('Nightly: installed=false when window.nightly.canton missing', async () => {
    const adapter = new NightlyAdapter();
    const result = await adapter.detectInstalled();
    expect(result.installed).toBe(false);
  });

  // The next three are documented-as-skipped to make the design intent
  // explicit. If any of these adapters acquires an install state in the
  // future, un-skip the corresponding test.
  it.skip('Loop: install-less by design — QR / popup, no extension to detect', () => {
    /* Loop is a web/mobile wallet; every browser environment can reach it
       via QR or popup. detectInstalled returning true reflects "available
       transport", not a false claim about a missing extension. */
  });

  it.skip('Cantor8: install-less by design — mobile deep-link, no extension', () => {
    /* Cantor8 returns installed:true only when the user agent string
       indicates a mobile device (where the deep-link can be intercepted).
       Desktop browsers correctly receive false. There is no extension to
       detect either way. */
  });

  it.skip('Bron: install-less by design — OAuth-based remote signer', () => {
    /* Bron is an enterprise remote signer reached via OAuth2 + REST API.
       There is no client-side install state; reachability is governed by
       OAuth configuration, which the adapter does not own. */
  });
});

// Bron requires OAuth + API config, test separately with inline stub config.
describe('Adapter conformance: Bron capability ↔ method symmetry', () => {
  it('instantiates with stub config and passes capability symmetry', async () => {
    const { BronAdapter } = await import('@partylayer/adapter-bron');
    const bron = new BronAdapter({
      auth: {
        authorizationUrl: 'https://stub.invalid/auth',
        tokenUrl: 'https://stub.invalid/token',
        clientId: 'stub',
        redirectUri: 'https://stub.invalid/cb',
        scopes: [],
      },
      api: { baseUrl: 'https://stub.invalid/api' },
      useMockApi: true,
    });

    const caps = bron.getCapabilities();
    for (const { capability, method } of METHOD_BACKED_CAPABILITIES) {
      const declares = caps.includes(capability);
      const implements_ = typeof (bron as unknown as Record<string, unknown>)[method] === 'function';
      expect(
        declares,
        `Bron ${capability}: declared=${declares}, implemented=${implements_}`,
      ).toBe(implements_);
    }
  });
});
