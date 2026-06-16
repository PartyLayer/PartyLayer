/**
 * Re-pointed Send parity test (parity step 3/3 — the proof). TEST-ONLY.
 *
 * Proves that the grown GenericAnnounceAdapter, configured the way Send's registry
 * entry would declare it, produces the SAME session.metadata + method surface that
 * the bespoke Send adapter does — WITHOUT touching adapter-send (read-only reference).
 *
 * Fixtures + the expected-metadata logic are READ-ONLY copies of Send's own:
 *  - SEND_FIXTURE_STATUS / SEND_FIXTURE_ACCOUNT mirror REAL_STATUS / REAL_PRIMARY_ACCOUNT
 *    in packages/adapters/send/src/__mocks__/window-canton.ts.
 *  - sendBuildSessionMetadata() replicates buildSessionMetadata() in
 *    packages/adapters/send/src/send-adapter.ts (l.440) + SEND_SIGNING_METHOD='webauthn-prf'.
 * Copied (not imported) so this test never reaches into another package's internals.
 */
import { describe, it, expect, vi } from 'vitest';
import { toPartyId, type CIP0103Provider } from '@partylayer/core';
import { GenericAnnounceAdapter } from './announce-adapter';

// ── READ-ONLY copies of Send's real-extension fixtures ──────────────────────
const SEND_KERNEL_ID = 'ldmohiccoioolenadmogclhoklmanpgi';
const SEND_FIXTURE_STATUS = {
  kernel: { id: SEND_KERNEL_ID, clientType: 'browser', url: 'https://api-mainnet.cantonwallet.com', userUrl: 'https://cantonwallet.com' },
  isConnected: true,
  isNetworkConnected: true,
  network: { networkId: 'canton:mainnet', ledgerApi: { baseUrl: 'https://api-mainnet.cantonwallet.com' } },
  session: { accessToken: 'eyJhbGc...truncated.JWT.token', userId: 'cantonwallet-anilkaracay' },
};
const SEND_FIXTURE_ACCOUNT = {
  primary: true,
  partyId: 'cantonwallet-anilkaracay::12207f8a5f7678134e9d67669722ce0b343adfb272005f14909e3c633b2fbe19caf5',
  status: 'allocated',
  hint: 'cantonwallet-anilkaracay',
  publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAECyWo0Qf7AZ6L77uzthc+uu3UChGYtzffXkfRKEkF0yEbu8Snj3CMN4RpkDN4VXPEgGJhjDXOQUe3z8JKHSc2RA==',
  namespace: '12207f8a5f7678134e9d67669722ce0b343adfb272005f14909e3c633b2fbe19caf5',
  networkId: 'canton:mainnet',
  signingProviderId: 'webauthn-prf',
};

/** Replica of Send's bespoke buildSessionMetadata (send-adapter.ts:440), read-only. */
const SEND_SIGNING_METHOD = 'webauthn-prf';
function sendBuildSessionMetadata(status: typeof SEND_FIXTURE_STATUS, account: typeof SEND_FIXTURE_ACCOUNT): Record<string, string> {
  const meta: Record<string, string> = {
    kernelId: status.kernel?.id ?? '',
    signingProviderId: account.signingProviderId,
    signingMethod: SEND_SIGNING_METHOD,
    publicKey: account.publicKey,
    namespace: account.namespace,
    networkId: account.networkId,
    hint: account.hint,
  };
  if (status.network?.ledgerApi?.baseUrl) meta.ledgerApiBaseUrl = status.network.ledgerApi.baseUrl;
  if (status.session?.userId) meta.userId = status.session.userId;
  return meta;
}

/** A CIP-0103 provider over the fixtures (what SendProvider's channel would return). */
function fixtureProvider(status: unknown): CIP0103Provider {
  return {
    request: vi.fn(async (args: { method: string }) =>
      ({ connect: status, getPrimaryAccount: SEND_FIXTURE_ACCOUNT, status }[args.method])) as CIP0103Provider['request'],
    on: () => {},
    emit: () => false,
    removeListener: () => {},
  } as unknown as CIP0103Provider;
}

/** Construct the generic adapter the way Send's registry entry would declare it. */
function sendStyleAdapter(status: unknown = SEND_FIXTURE_STATUS) {
  return new GenericAnnounceAdapter({
    announceId: SEND_KERNEL_ID,
    name: 'Send',
    provider: fixtureProvider(status),
    // capabilities (events/restore/ledgerApi) + adapter.config that Send's entry would carry.
    config: { metadata: true, restore: true, ledgerApi: true, events: true, staticMetadata: { signingMethod: SEND_SIGNING_METHOD } },
  });
}

const ctx = { network: 'canton:mainnet' } as never;

describe('re-pointed Send parity (step 3/3)', () => {
  it('metadata parity: generic adapter connect() === Send buildSessionMetadata field-by-field (kernel present)', async () => {
    const adapter = sendStyleAdapter();
    const { session, partyId } = await adapter.connect(ctx);

    const expected = sendBuildSessionMetadata(SEND_FIXTURE_STATUS, SEND_FIXTURE_ACCOUNT);
    // EXACT equality of the populated set — kernelId, signingProviderId, signingMethod,
    // publicKey, namespace, networkId, hint, ledgerApiBaseUrl, userId.
    expect(session.metadata).toEqual(expected);
    expect(partyId).toEqual(toPartyId(SEND_FIXTURE_ACCOUNT.partyId));
  });

  it('documented difference (no-kernel): generic OMITS kernelId where Send would emit kernelId:""', async () => {
    // Send's `status.kernel?.id ?? ''` emits kernelId:'' when no kernel; the generic
    // omits the key (cleaner). Send NEVER hits this (passkey ⇒ always a kernel), and
    // kernelId is read NOWHERE (session.metadata is an opaque Record) — so the
    // difference is cosmetic + harmless. Documented honestly, not hidden.
    const statusNoKernel = { isConnected: true, network: SEND_FIXTURE_STATUS.network, session: SEND_FIXTURE_STATUS.session };
    const adapter = sendStyleAdapter(statusNoKernel);
    const { session } = await adapter.connect(ctx);
    expect(session.metadata).toBeDefined();
    expect('kernelId' in (session.metadata as object)).toBe(false); // omitted, not ''
    // Send's replica would have emitted kernelId:'' here:
    expect(sendBuildSessionMetadata({ ...SEND_FIXTURE_STATUS, kernel: undefined as never }, SEND_FIXTURE_ACCOUNT).kernelId).toBe('');
  });

  it('method/capability surface parity (minus transport/detection — SendProvider/Phase-2 concern)', () => {
    const adapter = sendStyleAdapter();
    // Methods Send exposes (the RPC + lifecycle surface):
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.signMessage).toBe('function');
    expect(typeof adapter.submitTransaction).toBe('function');
    expect(typeof adapter.restore).toBe('function'); // configured
    expect(typeof adapter.ledgerApi).toBe('function'); // configured
    expect(typeof adapter.on).toBe('function'); // configured (events)
    // Advertised optional capabilities match Send's RPC set:
    expect(adapter.getCapabilities()).toEqual(
      expect.arrayContaining(['connect', 'signMessage', 'submitTransaction', 'restore', 'ledgerApi', 'events']),
    );
    // NOTE: 'injected' (transport) + provider detection are SendProvider's job and a
    // separate Phase-2 real-extension concern, intentionally NOT part of this
    // adapterless metadata/method parity proof.
  });
});
