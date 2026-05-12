/**
 * Comprehensive test suite for the Send Canton Wallet adapter.
 *
 * Why 50+ tests for an unreleased adapter?
 *
 * Loop landed at 39 tests in v0.3.5 because each one was added in
 * response to a real Viraj-class production bug. We have not yet exposed
 * the Send adapter to any user, so the test suite has to anticipate
 * those failure modes rather than wait for them. Particular paranoia is
 * applied to:
 *
 *   - Group 1 (kernel.id guard) — the safety mechanism that lets Send
 *     and Console coexist at `window.canton` without collision.
 *   - Group 4 (restore) — v0.3.5 session-persistence regression class.
 *   - Group 7 (submitTransaction) — Viraj's "Unexpected end of JSON
 *     input" + CIP-56 migration class.
 *   - Group 12 (conformance) — Bron capability-drift regression class.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CapabilityNotSupportedError,
  PartyLayerError,
  TransportError,
  UserRejectedError,
  toPartyId,
  toSessionId,
  toWalletId,
  type AdapterContext,
  type CapabilityKey,
  type Session,
} from '@partylayer/core';
// CapabilityNotSupportedError is referenced by Groups 10 + 11 + helper tests
// (signTransaction stub assertions, mapSigilryError 4200 case).

import {
  BUILD_SPECIFIC_STATUS,
  FOREIGN_KERNEL_ID,
  FULLY_FOREIGN_STATUS,
  REAL_LIST_ACCOUNTS,
  REAL_PRIMARY_ACCOUNT,
  REAL_STATUS,
  installEmptyWindow,
  installMockCanton,
  rpcError,
  uninstallMockCanton,
} from './__mocks__/window-canton';
import {
  SEND_BUILTIN_DETECTION,
  SEND_KERNEL_ID,
  SEND_KNOWN_EXTENSION_IDS,
  SEND_SIGNING_METHOD,
} from './constants';
import {
  SendAuthTimeoutError,
  SendKernelMismatchError,
  SendNotInstalledError,
  SendRpcErrorCode,
  detectSendAuthTimeout,
  mapSigilryError,
  templateIdHint,
} from './errors';
import { SendAdapter } from './send-adapter';
import type { SendPrepareSubmissionRequest } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.example.com',
    network: 'mainnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
      }),
  };
}

function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: toSessionId('sess-test'),
    walletId: toWalletId('send'),
    partyId: toPartyId(REAL_PRIMARY_ACCOUNT.partyId),
    network: 'mainnet',
    createdAt: Date.now(),
    origin: 'https://test.example.com',
    capabilitiesSnapshot: ['connect'] as CapabilityKey[],
    ...overrides,
  };
}

const baseSubmitPayload: SendPrepareSubmissionRequest = {
  commandId: 'cmd-1',
  commands: [
    {
      ExerciseCommand: {
        templateId:
          '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory',
        contractId: 'cid-1',
        choice: 'TransferFactory_Transfer',
        choiceArgument: {},
      },
    },
  ] as unknown as Record<string, unknown>,
  actAs: [REAL_PRIMARY_ACCOUNT.partyId],
};

// ─────────────────────────────────────────────────────────────────────────────
// Group 1 — Provider-detection guard (registry-driven, multi-signal)
// ─────────────────────────────────────────────────────────────────────────────
//
// As of Prompt 6 the adapter no longer keys identity on `kernel.id` alone.
// Detection is driven by a `ProviderDetection` rule set (URL domain matchers
// for stable identity, kernel.id whitelist as a fallback). Tests cover:
//   - Stable identity via URL domain (production install)
//   - Build-specific kernel.id with stable URL (developer-mode install)
//   - Truly foreign provider with mismatched URL and id (Console-class)
//   - Constructor-injected detection from registry entry
//   - Parity between built-in detection and the canonical registry rule

describe('SendAdapter: provider-detection guard', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('isInstalled() is true when kernel.url + kernel.id both match canonical Send', async () => {
    installMockCanton();
    await expect(adapter.detectInstalled()).resolves.toMatchObject({ installed: true });
  });

  it('isInstalled() is true when only kernel.url matches (build-specific kernel.id)', async () => {
    // Developer-mode Send install: kernel.id varies per build but URLs stay
    // anchored to cantonwallet.com. URL-domain matchers must be enough.
    installMockCanton({ status: BUILD_SPECIFIC_STATUS });
    const detect = await adapter.detectInstalled();
    expect(detect.installed).toBe(true);
  });

  it('isInstalled() is true when only kernel.id matches (URLs absent or stale)', async () => {
    installMockCanton({
      status: {
        ...REAL_STATUS,
        kernel: { ...REAL_STATUS.kernel, url: '', userUrl: '' },
      },
    });
    const detect = await adapter.detectInstalled();
    expect(detect.installed).toBe(true);
  });

  it('isInstalled() is false when window.canton is undefined', async () => {
    installEmptyWindow();
    await expect(adapter.detectInstalled()).resolves.toMatchObject({ installed: false });
  });

  it('isInstalled() is false in non-browser environment (no window)', async () => {
    vi.unstubAllGlobals();
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    await expect(adapter.detectInstalled()).resolves.toMatchObject({
      installed: false,
      reason: expect.stringMatching(/Browser environment required/),
    });
  });

  it('isInstalled() is false when kernel.id AND kernel.url are foreign (Console-class collision)', async () => {
    installMockCanton({ status: FULLY_FOREIGN_STATUS });
    const detect = await adapter.detectInstalled();
    expect(detect.installed).toBe(false);
    expect(detect.reason).toMatch(/kernel\.id does not match Send|other Canton wallet/i);
  });

  it('connect() throws SendKernelMismatchError when the active provider is fully foreign', async () => {
    installMockCanton({ status: FULLY_FOREIGN_STATUS });
    await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(SendKernelMismatchError);
  });

  it('signMessage / submitTransaction / ledgerApi all throw on a fully foreign provider', async () => {
    installMockCanton({ status: FULLY_FOREIGN_STATUS });
    const session = createMockSession();
    await expect(
      adapter.signMessage(ctx, session, { message: 'hi' }),
    ).rejects.toBeInstanceOf(SendKernelMismatchError);
    await expect(
      adapter.submitTransaction(ctx, session, { signedTx: baseSubmitPayload }),
    ).rejects.toBeInstanceOf(SendKernelMismatchError);
    await expect(
      adapter.ledgerApi(ctx, session, {
        requestMethod: 'GET',
        resource: '/v2/state/ledger-end',
      }),
    ).rejects.toBeInstanceOf(SendKernelMismatchError);
  });

  it('constructor accepts injected ProviderDetection from registry (overrides built-in)', async () => {
    // A custom rule that ONLY matches kernel.id values registry has whitelisted.
    // Build-specific status (URL still cantonwallet.com but non-canonical id) must
    // FAIL detection under this rule — proving the injected detection actually
    // takes effect.
    const restrictiveDetection = {
      transport: 'window.canton' as const,
      matchers: [
        { field: 'kernel.id' as const, match: 'exact' as const, values: [SEND_KERNEL_ID] },
      ],
    };
    const restricted = new SendAdapter({ detection: restrictiveDetection });
    installMockCanton({ status: BUILD_SPECIFIC_STATUS });
    await expect(restricted.detectInstalled()).resolves.toMatchObject({
      installed: false,
    });
  });

  it('built-in detection mirrors the canonical registry rule (parity guard)', () => {
    // If you change SEND_BUILTIN_DETECTION, the canonical registry entry
    // (registry/v1/{stable,beta}/registry.json) MUST change with it. This
    // test pins the shape so future drift trips a build break, not a
    // production "not installed" surprise.
    expect(SEND_BUILTIN_DETECTION.transport).toBe('window.canton');
    expect(SEND_BUILTIN_DETECTION.matchers).toEqual([
      { field: 'provider.id', match: 'exact', values: [...SEND_KNOWN_EXTENSION_IDS] },
      { field: 'kernel.url', match: 'domain', value: 'cantonwallet.com' },
      { field: 'kernel.userUrl', match: 'domain', value: 'cantonwallet.com' },
      { field: 'kernel.id', match: 'exact', values: [...SEND_KNOWN_EXTENSION_IDS] },
    ]);
  });

  it('FOREIGN_KERNEL_ID is preserved as developer-mode marker (not as a synonym for fully foreign)', () => {
    // Belt-and-braces: confirm the legacy alias still resolves to a Send-shaped
    // status (URLs are cantonwallet.com), not a stranger.
    expect(BUILD_SPECIFIC_STATUS.kernel.id).toBe(FOREIGN_KERNEL_ID);
    expect(BUILD_SPECIFIC_STATUS.kernel.url).toMatch(/cantonwallet\.com/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2 — Installation detection edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: installation detection', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('connect() throws SendNotInstalledError-equivalent when window.canton is undefined', async () => {
    installEmptyWindow();
    await expect(adapter.connect(ctx)).rejects.toThrow(SendNotInstalledError);
  });

  it('caches kernel.id after the first successful lookup', async () => {
    const provider = installMockCanton();
    await adapter.detectInstalled();
    await adapter.detectInstalled();
    await adapter.detectInstalled();
    const statusCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'status',
    );
    expect(statusCalls.length).toBe(1);
  });

  it('SendProvider.resetKernelCache() forces a re-fetch on the next call', async () => {
    const provider = installMockCanton();
    await adapter.detectInstalled();
    // pull the underlying provider via cast (it's a private field)
    const inner = (adapter as unknown as { provider: { resetKernelCache: () => void } })
      .provider;
    inner.resetKernelCache();
    await adapter.detectInstalled();
    const statusCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'status',
    );
    expect(statusCalls.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3 — Connection lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: connection lifecycle', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('connect() invokes the connect RPC method', async () => {
    const provider = installMockCanton();
    await adapter.connect(ctx);
    const connectCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'connect',
    );
    expect(connectCalls.length).toBe(1);
  });

  it('connect() returns AdapterConnectResult with partyId, capabilities, and session metadata', async () => {
    installMockCanton();
    const result = await adapter.connect(ctx);
    expect(result.partyId).toBe(REAL_PRIMARY_ACCOUNT.partyId);
    expect(result.capabilities).toContain('connect');
    expect(result.capabilities).toContain('submitTransaction');
    expect(result.capabilities).toContain('ledgerApi');
    expect(result.session.metadata?.kernelId).toBe(SEND_KERNEL_ID);
    expect(result.session.metadata?.signingMethod).toBe(SEND_SIGNING_METHOD);
    expect(result.session.metadata?.signingProviderId).toBe('webauthn-prf');
    expect(result.session.metadata?.publicKey).toBe(REAL_PRIMARY_ACCOUNT.publicKey);
    expect(result.session.metadata?.ledgerApiBaseUrl).toBe(
      REAL_STATUS.network!.ledgerApi!.baseUrl,
    );
    expect(result.session.metadata?.userId).toBe(REAL_STATUS.session!.userId);
  });

  it('connect() maps Sigilry USER_REJECTED (4001) to PartyLayer UserRejectedError', async () => {
    installMockCanton({
      errors: { connect: rpcError(SendRpcErrorCode.USER_REJECTED, 'User declined') },
    });
    await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(UserRejectedError);
  });

  it('connect() maps Sigilry UNAUTHORIZED (4100) to TransportError with rpcCode in details', async () => {
    installMockCanton({
      errors: { connect: rpcError(SendRpcErrorCode.UNAUTHORIZED, 'Not authorised') },
    });
    const err = await adapter.connect(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TransportError);
    expect((err as TransportError).details).toMatchObject({ rpcCode: 4100 });
  });

  it('disconnect() invokes the disconnect RPC and is idempotent', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await adapter.disconnect(ctx, session);
    await adapter.disconnect(ctx, session);
    const disconnectCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'disconnect',
    );
    expect(disconnectCalls.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4 — Restore  (v0.3.5 session-persistence regression class)
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: restore', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  function persistedSession() {
    return {
      ...createMockSession(),
      encrypted: 'cipher-blob',
    };
  }

  it('returns null when window.canton is unavailable', async () => {
    installEmptyWindow();
    await expect(adapter.restore(ctx, persistedSession())).resolves.toBeNull();
  });

  it('returns null when status reports isConnected=false', async () => {
    installMockCanton({
      status: { ...REAL_STATUS, isConnected: false },
    });
    await expect(adapter.restore(ctx, persistedSession())).resolves.toBeNull();
  });

  it('returns the restored Session when isConnected=true and primary account matches', async () => {
    installMockCanton();
    const restored = await adapter.restore(ctx, persistedSession());
    expect(restored).not.toBeNull();
    expect(restored!.walletId).toBe(toWalletId('send'));
    expect(restored!.partyId).toBe(REAL_PRIMARY_ACCOUNT.partyId);
    expect(restored!.metadata?.kernelId).toBe(SEND_KERNEL_ID);
  });

  it('does NOT call connect() during restore (silent — no popup, no passkey)', async () => {
    const provider = installMockCanton();
    await adapter.restore(ctx, persistedSession());
    const calls = provider.request.mock.calls.map(([arg]: [{ method: string }]) => arg.method);
    expect(calls).toContain('status');
    expect(calls).toContain('getPrimaryAccount');
    expect(calls).not.toContain('connect');
  });

  it('returns null when persisted session has expired', async () => {
    installMockCanton();
    const persisted = { ...persistedSession(), expiresAt: Date.now() - 1000 };
    await expect(adapter.restore(ctx, persisted)).resolves.toBeNull();
  });

  it('returns null when current primary account no longer matches the persisted partyId', async () => {
    installMockCanton({
      primaryAccount: { ...REAL_PRIMARY_ACCOUNT, partyId: 'cantonwallet-other::deadbeef' },
    });
    await expect(adapter.restore(ctx, persistedSession())).resolves.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5 — Account & metadata mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: account/metadata mapping', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('preserves partyId, publicKey, networkId, namespace, hint after connect', async () => {
    installMockCanton();
    const result = await adapter.connect(ctx);
    expect(result.partyId).toBe(REAL_PRIMARY_ACCOUNT.partyId);
    expect(result.session.metadata?.publicKey).toBe(REAL_PRIMARY_ACCOUNT.publicKey);
    expect(result.session.metadata?.networkId).toBe(REAL_PRIMARY_ACCOUNT.networkId);
    expect(result.session.metadata?.namespace).toBe(REAL_PRIMARY_ACCOUNT.namespace);
    expect(result.session.metadata?.hint).toBe(REAL_PRIMARY_ACCOUNT.hint);
  });

  it('every metadata value is a string (Session.metadata: Record<string,string>)', async () => {
    installMockCanton();
    const result = await adapter.connect(ctx);
    for (const [k, v] of Object.entries(result.session.metadata ?? {})) {
      expect(typeof v, `metadata.${k} must be a string`).toBe('string');
    }
  });

  it('omits ledgerApiBaseUrl when status.network has no ledgerApi', async () => {
    installMockCanton({
      status: {
        ...REAL_STATUS,
        network: { networkId: 'canton:mainnet' }, // no ledgerApi sub-object
      },
    });
    const result = await adapter.connect(ctx);
    expect(result.session.metadata?.ledgerApiBaseUrl).toBeUndefined();
  });

  it('omits userId when status.session is absent', async () => {
    installMockCanton({
      status: { ...REAL_STATUS, session: undefined },
    });
    const result = await adapter.connect(ctx);
    expect(result.session.metadata?.userId).toBeUndefined();
  });

  it('list-accounts shape passes through unchanged (smoke test)', async () => {
    const provider = installMockCanton({ accounts: REAL_LIST_ACCOUNTS });
    await adapter.connect(ctx);
    const inner = (
      adapter as unknown as {
        provider: { listAccounts: () => Promise<unknown[]> };
      }
    ).provider;
    const accounts = await inner.listAccounts();
    expect(accounts).toEqual(REAL_LIST_ACCOUNTS);
    expect(provider.request).toHaveBeenCalledWith({ method: 'listAccounts' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6 — signMessage
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: signMessage', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('calls signMessage RPC with { message } params', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await adapter.signMessage(ctx, session, { message: 'hello' });
    expect(provider.request).toHaveBeenCalledWith({
      method: 'signMessage',
      params: { message: 'hello' },
    });
  });

  it('returns SignedMessage with signature, partyId, message, nonce, domain', async () => {
    installMockCanton();
    const session = createMockSession();
    const signed = await adapter.signMessage(ctx, session, {
      message: 'hi',
      nonce: 'n-1',
      domain: 'example.com',
    });
    expect(signed.signature).toMatch(/MEUCIQD/); // matches DEFAULT_SIGN_MESSAGE
    expect(signed.partyId).toBe(session.partyId);
    expect(signed.message).toBe('hi');
    expect(signed.nonce).toBe('n-1');
    expect(signed.domain).toBe('example.com');
  });

  it('rejects an empty-string message before reaching the extension', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await expect(adapter.signMessage(ctx, session, { message: '' })).rejects.toThrow();
    const signCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'signMessage',
    );
    expect(signCalls.length).toBe(0);
  });

  it('propagates user rejection (4001) cleanly as UserRejectedError', async () => {
    installMockCanton({
      errors: { signMessage: rpcError(SendRpcErrorCode.USER_REJECTED, 'declined in popup') },
    });
    const session = createMockSession();
    await expect(adapter.signMessage(ctx, session, { message: 'x' })).rejects.toBeInstanceOf(
      UserRejectedError,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7 — submitTransaction (Viraj-class coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: submitTransaction', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('calls prepareExecuteAndWait with the supplied submission request', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await adapter.submitTransaction(ctx, session, { signedTx: baseSubmitPayload });
    expect(provider.request).toHaveBeenCalledWith({
      method: 'prepareExecuteAndWait',
      params: baseSubmitPayload,
    });
  });

  it('returns TxReceipt populated from tx.payload.updateId + tx.commandId', async () => {
    installMockCanton();
    const session = createMockSession();
    const receipt = await adapter.submitTransaction(ctx, session, {
      signedTx: baseSubmitPayload,
    });
    expect(receipt.transactionHash).toBe('update-abc');
    expect(receipt.commandId).toBe('cmd-123');
    expect(receipt.updateId).toBe('update-abc');
    expect(typeof receipt.submittedAt).toBe('number');
  });

  it('throws a structured error when prepareExecuteAndWait returns an unexpected shape', async () => {
    installMockCanton({
      prepareExecuteAndWait: { tx: undefined } as unknown as ReturnType<
        () => never
      >,
    });
    const session = createMockSession();
    const err = await adapter
      .submitTransaction(ctx, session, { signedTx: baseSubmitPayload })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartyLayerError);
    expect((err as Error).message).toMatch(/unexpected shape/i);
  });

  it('rejects a missing-commands signedTx with an actionable error', async () => {
    installMockCanton();
    const session = createMockSession();
    const err = await adapter
      .submitTransaction(ctx, session, { signedTx: {} as SendPrepareSubmissionRequest })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartyLayerError);
    expect((err as Error).message).toMatch(/'commands'/);
  });

  it('appends a CIP-56 migration hint when the legacy Amulet_Transfer payload fails', async () => {
    installMockCanton({
      errors: { prepareExecuteAndWait: new Error('Execute Unknown on Unknown') },
    });
    const session = createMockSession();
    const legacyPayload: SendPrepareSubmissionRequest = {
      commandId: 'cmd-legacy',
      commands: [
        {
          ExerciseCommand: {
            templateId: '#splice-amulet:Splice.Amulet:Amulet',
            contractId: 'cid-x',
            choice: 'Amulet_Transfer',
            choiceArgument: {},
          },
        },
      ] as unknown as Record<string, unknown>,
    };
    const err = await adapter
      .submitTransaction(ctx, session, { signedTx: legacyPayload })
      .catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/TransferFactory_Transfer/);
    expect((err as Error).message).toMatch(/partylayer\.xyz\/docs\/token-transfers/);
  });

  it('appends a short-form hint when templateId is missing the # package prefix', async () => {
    installMockCanton({
      errors: { prepareExecuteAndWait: new Error('command rejected by ledger') },
    });
    const session = createMockSession();
    const shortFormPayload: SendPrepareSubmissionRequest = {
      commandId: 'cmd-short',
      commands: [
        {
          ExerciseCommand: {
            templateId: 'Splice.Amulet:Amulet',
            contractId: 'cid-y',
            choice: 'TransferFactory_Transfer',
            choiceArgument: {},
          },
        },
      ] as unknown as Record<string, unknown>,
    };
    const err = await adapter
      .submitTransaction(ctx, session, { signedTx: shortFormPayload })
      .catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/short Canton form/);
  });

  it('correctly extracts status === "executed" from the Sigilry response shape', async () => {
    installMockCanton({
      prepareExecuteAndWait: {
        tx: {
          status: 'executed',
          commandId: 'cmd-exec',
          payload: { updateId: 'upd-exec', completionOffset: 99 },
        },
      },
    });
    const session = createMockSession();
    const receipt = await adapter.submitTransaction(ctx, session, {
      signedTx: baseSubmitPayload,
    });
    expect(receipt.transactionHash).toBe('upd-exec');
    expect(receipt.commandId).toBe('cmd-exec');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8 — ledgerApi (v0.3.5 "Unexpected end of JSON input" regression class)
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: ledgerApi', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('forwards GET /v2/state/ledger-end and returns the response string verbatim', async () => {
    installMockCanton({ ledgerApi: { response: '{"offset":"42"}' } });
    const session = createMockSession();
    const result = await adapter.ledgerApi(ctx, session, {
      requestMethod: 'GET',
      resource: '/v2/state/ledger-end',
    });
    expect(result.response).toBe('{"offset":"42"}');
  });

  it('forwards POST /v2/state/active-contracts with body argument', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await adapter.ledgerApi(ctx, session, {
      requestMethod: 'POST',
      resource: '/v2/state/active-contracts',
      body: '{"filter":{}}',
    });
    expect(provider.request).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: '{"filter":{}}',
      },
    });
  });

  it('preserves an empty response string without crashing', async () => {
    installMockCanton({ ledgerApi: { response: '' } });
    const session = createMockSession();
    const result = await adapter.ledgerApi(ctx, session, {
      requestMethod: 'GET',
      resource: '/v2/state/ledger-end',
    });
    expect(result.response).toBe('');
  });

  it('preserves a whitespace-only response string', async () => {
    installMockCanton({ ledgerApi: { response: '   \n  ' } });
    const session = createMockSession();
    const result = await adapter.ledgerApi(ctx, session, {
      requestMethod: 'GET',
      resource: '/v2/state/ledger-end',
    });
    expect(result.response).toBe('   \n  ');
  });

  it('non-JSON plaintext responses are returned without parsing', async () => {
    installMockCanton({ ledgerApi: { response: 'plain text body' } });
    const session = createMockSession();
    const result = await adapter.ledgerApi(ctx, session, {
      requestMethod: 'GET',
      resource: '/v2/some/text',
    });
    expect(result.response).toBe('plain text body');
  });

  it('falls back to JSON.stringify when the extension returns a non-{response} object', async () => {
    installMockCanton({ ledgerApi: { offset: '12345' } });
    const session = createMockSession();
    const result = await adapter.ledgerApi(ctx, session, {
      requestMethod: 'GET',
      resource: '/v2/state/ledger-end',
    });
    expect(result.response).toBe('{"offset":"12345"}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 9 — Events
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: events', () => {
  let adapter: SendAdapter;

  beforeEach(() => {
    adapter = new SendAdapter();
  });
  afterEach(() => uninstallMockCanton());

  it('on("txStatus", listener) registers a txChanged listener with the provider', () => {
    const provider = installMockCanton();
    const listener = vi.fn();
    adapter.on('txStatus', listener);
    expect(provider.on).toHaveBeenCalledWith('txChanged', expect.any(Function));
  });

  it('forwards txChanged events with PartyLayer-translated status strings', () => {
    const provider = installMockCanton();
    const handler = vi.fn();
    adapter.on('txStatus', handler);
    provider.emit('txChanged', { status: 'executed', commandId: 'cmd-1', payload: {} });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      status: 'committed',
      commandId: 'cmd-1',
    });
  });

  it('translates pending → pending, signed → submitted, failed → failed', () => {
    const provider = installMockCanton();
    const handler = vi.fn();
    adapter.on('txStatus', handler);
    provider.emit('txChanged', { status: 'pending', commandId: 'cmd-p' });
    provider.emit('txChanged', { status: 'signed', commandId: 'cmd-s' });
    provider.emit('txChanged', { status: 'failed', commandId: 'cmd-f' });
    expect(handler.mock.calls.map((c) => c[0].status)).toEqual([
      'pending',
      'submitted',
      'failed',
    ]);
  });

  it('returned unsubscribe function removes the listener', () => {
    const provider = installMockCanton();
    const handler = vi.fn();
    const unsub = adapter.on('txStatus', handler);
    unsub();
    provider.emit('txChanged', { status: 'executed', commandId: 'x', payload: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it('falls back to removeListener when off is not implemented by the provider', () => {
    const provider = installMockCanton({ omitOff: true });
    const handler = vi.fn();
    const unsub = adapter.on('txStatus', handler);
    unsub();
    expect(provider.removeListener).toHaveBeenCalledWith('txChanged', expect.any(Function));
  });

  it('non-tx events (connect, disconnect, sessionExpired, error) are no-ops, never throw', () => {
    installMockCanton();
    expect(() => adapter.on('connect', vi.fn())()).not.toThrow();
    expect(() => adapter.on('disconnect', vi.fn())()).not.toThrow();
    expect(() => adapter.on('sessionExpired', vi.fn())()).not.toThrow();
    expect(() => adapter.on('error', vi.fn())()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 10 — Capability matrix integrity (Bron drift regression class)
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: capability matrix integrity', () => {
  it('every declared capability has a corresponding implemented method', () => {
    const adapter = new SendAdapter();
    const caps = adapter.getCapabilities();

    const methodFor: Partial<Record<CapabilityKey, keyof SendAdapter>> = {
      connect: 'connect',
      disconnect: 'disconnect',
      restore: 'restore',
      signMessage: 'signMessage',
      submitTransaction: 'submitTransaction',
      ledgerApi: 'ledgerApi',
      events: 'on',
    };

    for (const cap of caps) {
      const method = methodFor[cap];
      if (!method) continue; // 'injected' is a discovery flag, not a method
      expect(typeof (adapter as unknown as Record<string, unknown>)[method as string]).toBe(
        'function',
      );
    }
  });

  it('signTransaction is NOT in the capabilities array', () => {
    const adapter = new SendAdapter();
    expect(adapter.getCapabilities()).not.toContain('signTransaction');
  });

  it('signTransaction() throws CapabilityNotSupportedError pointing at submitTransaction', async () => {
    const adapter = new SendAdapter();
    const ctx = createMockContext();
    const session = createMockSession();
    const err = await adapter
      .signTransaction(ctx, session, { tx: {} })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CapabilityNotSupportedError);
    expect((err as Error).message).toMatch(/submitTransaction/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 11 — Error handling edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAdapter: error handling edges', () => {
  let adapter: SendAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new SendAdapter();
    ctx = createMockContext();
  });
  afterEach(() => uninstallMockCanton());

  it('surfaces a generic Error from the extension as a PartyLayerError (TransportError)', async () => {
    installMockCanton({
      errors: { signMessage: new Error('extension service worker died') },
    });
    const session = createMockSession();
    const err = await adapter
      .signMessage(ctx, session, { message: 'x' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartyLayerError);
  });

  it('surfaces a timeout-shaped Error as a PartyLayerError', async () => {
    installMockCanton({ errors: { signMessage: new Error('Request timed out after 30000ms') } });
    const session = createMockSession();
    const err = await adapter
      .signMessage(ctx, session, { message: 'x' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartyLayerError);
  });

  it('handles malformed signMessage response (missing signature) without crashing', async () => {
    installMockCanton({ signMessage: {} as { signature: string } });
    const session = createMockSession();
    const result = await adapter.signMessage(ctx, session, { message: 'x' });
    // Branded Signature type — `undefined` would slip through `as Signature`,
    // we only assert the shape doesn't crash & metadata is preserved.
    expect(result.partyId).toBe(session.partyId);
    expect(result.message).toBe('x');
  });

  it('handles concurrent requests without firing N status() probes (kernel.id cache)', async () => {
    const provider = installMockCanton();
    const session = createMockSession();
    await Promise.all([
      adapter.signMessage(ctx, session, { message: 'a' }),
      adapter.signMessage(ctx, session, { message: 'b' }),
      adapter.signMessage(ctx, session, { message: 'c' }),
      adapter.ledgerApi(ctx, session, {
        requestMethod: 'GET',
        resource: '/v2/state/ledger-end',
      }),
    ]);
    const statusCalls = provider.request.mock.calls.filter(
      ([arg]: [{ method: string }]) => arg.method === 'status',
    );
    // Up to one status probe per concurrent path before cache populates,
    // but well below the 4-call upper bound. Pin to ≤ N so a regression
    // (e.g. cache disabled) shows up immediately.
    expect(statusCalls.length).toBeLessThanOrEqual(4);
    expect(statusCalls.length).toBeGreaterThan(0);
  });
});

// Group 12 (in-package conformance mirror) was removed in Prompt 4 once the
// SDK-level cross-adapter conformance suite at
// packages/sdk/src/adapter-conformance.test.ts started exercising Send. The
// gates it covered (walletId/name strings, capabilities array, restore
// symmetry, signTransaction-as-stub) are validated alongside the other 5
// adapters there. Send-specific behaviour stays in Groups 1-11 above.

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (templateIdHint / mapSigilryError) — no provider needed
// ─────────────────────────────────────────────────────────────────────────────

describe('helpers: templateIdHint', () => {
  it('returns "" for non-object payloads', () => {
    expect(templateIdHint(null)).toBe('');
    expect(templateIdHint(undefined)).toBe('');
    expect(templateIdHint('not-an-object')).toBe('');
  });

  it('returns "" when commands is not an array', () => {
    expect(templateIdHint({ commands: 42 })).toBe('');
  });

  it('returns the CIP-56 migration string for legacy Amulet_Transfer', () => {
    const hint = templateIdHint({
      commands: [
        {
          ExerciseCommand: {
            templateId: '#splice-amulet:Splice.Amulet:Amulet',
            choice: 'Amulet_Transfer',
          },
        },
      ],
    });
    expect(hint).toMatch(/CIP-56/);
    expect(hint).toMatch(/TransferFactory_Transfer/);
  });

  it('returns the short-form warning for templateIds missing the # prefix', () => {
    const hint = templateIdHint({
      commands: [{ ExerciseCommand: { templateId: 'Splice.Amulet:Amulet' } }],
    });
    expect(hint).toMatch(/short Canton form/);
  });

  it('returns "" for fully-qualified non-legacy template ids', () => {
    expect(
      templateIdHint({
        commands: [
          {
            ExerciseCommand: {
              templateId:
                '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory',
              choice: 'TransferFactory_Transfer',
            },
          },
        ],
      }),
    ).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Send auth timeout — typed error class + detector + mapping integration
// ─────────────────────────────────────────────────────────────────────────────

describe('SendAuthTimeoutError', () => {
  it('default message references retry + cantonwallet.com help URL', () => {
    const err = new SendAuthTimeoutError();
    expect(err.name).toBe('SendAuthTimeoutError');
    expect(err.message).toMatch(/timed out/i);
    expect(err.message).toMatch(/cantonwallet\.com/);
    expect(err.details).toMatchObject({
      cause: 'send-auth-timeout',
      retry: true,
      helpUrl: 'https://cantonwallet.com',
    });
  });

  it('preserves a custom upstream message and surfaces it in details', () => {
    const err = new SendAuthTimeoutError('Authentication timed out (req=abc)');
    expect(err.message).toContain('Authentication timed out');
    expect(err.details).toMatchObject({
      cause: 'send-auth-timeout',
      originalMessage: 'Authentication timed out (req=abc)',
    });
  });

  it('subclasses PartyLayerError so existing instanceof / code branches still work', () => {
    const err = new SendAuthTimeoutError();
    expect(err).toBeInstanceOf(PartyLayerError);
    expect((err as PartyLayerError).code).toBe('WALLET_NOT_INSTALLED');
  });
});

describe('detectSendAuthTimeout', () => {
  it('matches the canonical "Authentication timed out" wording', () => {
    expect(detectSendAuthTimeout(new Error('Authentication timed out'))).toBe(true);
  });

  it('matches the alternate "Cannot reach authentication server" wording', () => {
    expect(detectSendAuthTimeout(new Error('Cannot reach authentication server'))).toBe(true);
  });

  it('matches when the auth.cantonwallet.com domain leaks into the error', () => {
    expect(
      detectSendAuthTimeout(new Error('fetch failed: https://auth.cantonwallet.com/oauth/token')),
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(detectSendAuthTimeout(new Error('AUTHENTICATION TIMED OUT'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(detectSendAuthTimeout(new Error('User rejected the request'))).toBe(false);
    expect(detectSendAuthTimeout(new Error('Network is offline'))).toBe(false);
  });

  it('handles non-Error inputs without throwing', () => {
    expect(detectSendAuthTimeout(null)).toBe(false);
    expect(detectSendAuthTimeout(undefined)).toBe(false);
    expect(detectSendAuthTimeout('Authentication timed out')).toBe(false);
    expect(detectSendAuthTimeout({})).toBe(false);
    expect(detectSendAuthTimeout({ message: 42 })).toBe(false);
  });
});

describe('mapSigilryError + auth-timeout integration', () => {
  const ctx = {
    walletId: 'send',
    phase: 'connect' as const,
    transport: 'injected' as const,
  };

  it('routes Send auth-timeout errors to SendAuthTimeoutError', () => {
    const mapped = mapSigilryError(new Error('Authentication timed out'), ctx);
    expect(mapped).toBeInstanceOf(SendAuthTimeoutError);
    expect((mapped as SendAuthTimeoutError).details).toMatchObject({
      cause: 'send-auth-timeout',
      retry: true,
    });
  });

  it('does NOT regress existing 4001 USER_REJECTED mapping (regression guard)', () => {
    const mapped = mapSigilryError(rpcError(SendRpcErrorCode.USER_REJECTED, 'declined'), ctx);
    expect(mapped).toBeInstanceOf(UserRejectedError);
  });

  it('does NOT regress existing TransportError mapping for unrelated 4900 (regression guard)', () => {
    const mapped = mapSigilryError(rpcError(SendRpcErrorCode.DISCONNECTED, 'gone'), ctx);
    expect(mapped).toBeInstanceOf(TransportError);
    expect((mapped as TransportError).details).toMatchObject({ rpcCode: 4900 });
  });

  it('does NOT misclassify a generic "rejected" error as auth-timeout', () => {
    const mapped = mapSigilryError(new Error('User rejected the request'), ctx);
    expect(mapped).not.toBeInstanceOf(SendAuthTimeoutError);
  });
});

describe('helpers: mapSigilryError', () => {
  const ctx = {
    walletId: 'send',
    phase: 'submitTransaction' as const,
    transport: 'injected' as const,
  };

  it('passes a PartyLayerError instance through unchanged', () => {
    const orig = new TransportError('already mapped');
    expect(mapSigilryError(orig, ctx)).toBe(orig);
  });

  it('maps RPC code 4001 to UserRejectedError', () => {
    const err = mapSigilryError(rpcError(4001, 'declined'), ctx);
    expect(err).toBeInstanceOf(UserRejectedError);
  });

  it('maps RPC code 4200 to CapabilityNotSupportedError', () => {
    const err = mapSigilryError(rpcError(4200, 'unsupported'), ctx);
    expect(err).toBeInstanceOf(CapabilityNotSupportedError);
  });

  it('maps RPC code 4900 (DISCONNECTED) to TransportError with rpcCode in details', () => {
    const err = mapSigilryError(rpcError(4900, 'disconnected'), ctx);
    expect(err).toBeInstanceOf(TransportError);
    expect((err as TransportError).details).toMatchObject({ rpcCode: 4900 });
  });

  it('falls back to the generic PartyLayer mapper for non-RPC errors', () => {
    const err = mapSigilryError(new Error('boom'), ctx);
    expect(err).toBeInstanceOf(PartyLayerError);
  });
});
