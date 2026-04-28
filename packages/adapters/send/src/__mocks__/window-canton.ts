/**
 * Reusable `window.canton` mock for Send adapter tests.
 *
 * The fixtures in this file are NOT invented — every value was captured
 * from a real Send extension (kernel id `ldmohiccoioolenadmogclhoklmanpgi`)
 * during manual verification. Treat them as authoritative; tweaking a
 * field to make a test pass is almost certainly papering over a bug.
 */

import { vi } from 'vitest';

import { SEND_KERNEL_ID } from '../constants';
import type {
  SendAccount,
  SendCantonProvider,
  SendEventListener,
  SendEventName,
  SendLedgerApiResult,
  SendNetwork,
  SendPrepareExecuteAndWaitResult,
  SendRpcMethod,
  SendSignMessageResult,
  SendStatusResponse,
} from '../types';

// ── Real-runtime fixtures ──────────────────────────────────────────────────

export const REAL_STATUS: SendStatusResponse = {
  kernel: {
    id: SEND_KERNEL_ID,
    clientType: 'browser',
    url: 'https://api-mainnet.cantonwallet.com',
    userUrl: 'https://cantonwallet.com',
  },
  isConnected: true,
  isNetworkConnected: true,
  network: {
    networkId: 'canton:mainnet',
    ledgerApi: { baseUrl: 'https://api-mainnet.cantonwallet.com' },
  },
  session: {
    accessToken: 'eyJhbGc...truncated.JWT.token',
    userId: 'cantonwallet-anilkaracay',
  },
};

export const REAL_PRIMARY_ACCOUNT: SendAccount = {
  primary: true,
  partyId:
    'cantonwallet-anilkaracay::12207f8a5f7678134e9d67669722ce0b343adfb272005f14909e3c633b2fbe19caf5',
  status: 'allocated',
  hint: 'cantonwallet-anilkaracay',
  publicKey:
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAECyWo0Qf7AZ6L77uzthc+uu3UChGYtzffXkfRKEkF0yEbu8Snj3CMN4RpkDN4VXPEgGJhjDXOQUe3z8JKHSc2RA==',
  namespace: '12207f8a5f7678134e9d67669722ce0b343adfb272005f14909e3c633b2fbe19caf5',
  networkId: 'canton:mainnet',
  signingProviderId: 'webauthn-prf',
};

export const REAL_LIST_ACCOUNTS: SendAccount[] = [REAL_PRIMARY_ACCOUNT];

/**
 * A plausible-but-foreign extension id. Used in build-specific tests
 * (where Send is installed in developer mode, so kernel.id varies but
 * URL signals stay stable — registry detection MUST still match Send).
 */
export const FOREIGN_KERNEL_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

/**
 * Status that LOOKS like Send except for a non-canonical kernel.id —
 * mirrors the developer-mode Send install. URL-based matchers still
 * fire, so detection should pass.
 */
export const BUILD_SPECIFIC_STATUS: SendStatusResponse = {
  ...REAL_STATUS,
  kernel: { ...REAL_STATUS.kernel, id: FOREIGN_KERNEL_ID },
};

/** @deprecated Pre-Prompt-6 alias. New code should use {@link BUILD_SPECIFIC_STATUS}. */
export const FOREIGN_STATUS: SendStatusResponse = BUILD_SPECIFIC_STATUS;

/**
 * A truly foreign provider — different kernel.id AND different URL
 * domain. This is what a Console-class wallet at `window.canton` would
 * look like, and the case where Send adapter MUST refuse to act.
 */
export const FULLY_FOREIGN_STATUS: SendStatusResponse = {
  ...REAL_STATUS,
  kernel: {
    ...REAL_STATUS.kernel,
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://api.other-wallet.example.com',
    userUrl: 'https://other-wallet.example.com',
  },
};

// ── RPC error helpers ──────────────────────────────────────────────────────

export interface MockRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export function rpcError(code: number, message: string, data?: unknown): MockRpcError {
  return { code, message, data };
}

// ── Provider mock ──────────────────────────────────────────────────────────

export interface MockProviderConfig {
  /** Kernel id reported by `status`. Defaults to `SEND_KERNEL_ID`. */
  kernelId?: string;
  /** Replace whole status response. */
  status?: SendStatusResponse;
  /** Replace primary account response. */
  primaryAccount?: SendAccount;
  /** Replace list-accounts response. */
  accounts?: SendAccount[];
  /** Replace network response. */
  network?: SendNetwork;
  /** Replace signMessage response. */
  signMessage?: SendSignMessageResult;
  /** Replace prepareExecute response (default: null). */
  prepareExecute?: null | unknown;
  /** Replace prepareExecuteAndWait response. */
  prepareExecuteAndWait?: SendPrepareExecuteAndWaitResult;
  /** Replace ledgerApi response. */
  ledgerApi?: SendLedgerApiResult | unknown;
  /** Override individual methods to throw a specific error. */
  errors?: Partial<Record<SendRpcMethod, Error | MockRpcError>>;
  /** Suppress the `off` method to exercise the `removeListener` fallback. */
  omitOff?: boolean;
  /** Suppress both off and removeListener. */
  omitAllUnsubscribe?: boolean;
}

/**
 * Test-facing shape. Uses `vi.fn()` for `request`/`on`/`off` so tests can
 * assert call args; deliberately NOT structurally compatible with
 * `SendCantonProvider`'s typed `request<M>` signature (we cast at the
 * stubGlobal boundary instead).
 */
export interface MockCantonProvider {
  request: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off?: ReturnType<typeof vi.fn>;
  removeListener?: ReturnType<typeof vi.fn>;
  emit(event: SendEventName, ...args: unknown[]): void;
  listeners: Map<SendEventName, Set<SendEventListener>>;
  /** For inspection in tests — last config used to build the mock. */
  __config: MockProviderConfig;
}

const DEFAULT_PREPARE_EXECUTE_AND_WAIT: SendPrepareExecuteAndWaitResult = {
  tx: {
    status: 'executed',
    commandId: 'cmd-123',
    payload: { updateId: 'update-abc', completionOffset: 12345 },
  },
};

const DEFAULT_LEDGER_API: SendLedgerApiResult = {
  response: '{"offset":"12345"}',
};

const DEFAULT_SIGN_MESSAGE: SendSignMessageResult = {
  signature: 'MEUCIQDdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefAiBcafebabe==',
};

/**
 * Install a fully-typed mock provider at `window.canton` and return a
 * handle to it for assertions. Call `uninstallMockCanton()` in afterEach
 * to restore globals.
 */
export function installMockCanton(config: MockProviderConfig = {}): MockCantonProvider {
  const kernelId = config.kernelId ?? SEND_KERNEL_ID;
  const status: SendStatusResponse = config.status ?? {
    ...REAL_STATUS,
    kernel: { ...REAL_STATUS.kernel, id: kernelId },
  };
  const listeners = new Map<SendEventName, Set<SendEventListener>>();

  function maybeThrow(method: SendRpcMethod): void {
    const err = config.errors?.[method];
    if (!err) return;
    if (err instanceof Error) throw err;
    throw err; // plain object — exercises adapter's RPC-error code branches
  }

  const request = vi.fn(async (args: { method: SendRpcMethod; params?: unknown }) => {
    const m = args.method;
    maybeThrow(m);
    switch (m) {
      case 'status':
      case 'connect':
      case 'isConnected':
        return status;
      case 'disconnect':
        return null;
      case 'getActiveNetwork':
        return config.network ?? status.network;
      case 'getPrimaryAccount':
        return config.primaryAccount ?? REAL_PRIMARY_ACCOUNT;
      case 'listAccounts':
        return config.accounts ?? REAL_LIST_ACCOUNTS;
      case 'signMessage':
        return config.signMessage ?? DEFAULT_SIGN_MESSAGE;
      case 'prepareExecute':
        return config.prepareExecute ?? null;
      case 'prepareExecuteAndWait':
        return config.prepareExecuteAndWait ?? DEFAULT_PREPARE_EXECUTE_AND_WAIT;
      case 'ledgerApi':
        return config.ledgerApi ?? DEFAULT_LEDGER_API;
      default:
        throw new Error(`Unmocked method: ${String(m)}`);
    }
  });

  const on = vi.fn((event: SendEventName, listener: SendEventListener) => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(listener);
  });

  const off = vi.fn((event: SendEventName, listener: SendEventListener) => {
    listeners.get(event)?.delete(listener);
  });

  const removeListener = vi.fn((event: SendEventName, listener: SendEventListener) => {
    listeners.get(event)?.delete(listener);
  });

  const provider: MockCantonProvider = {
    listeners,
    __config: config,
    request: request as unknown as MockCantonProvider['request'],
    on: on as unknown as MockCantonProvider['on'],
    emit(event: SendEventName, ...args: unknown[]) {
      listeners.get(event)?.forEach((l) => l(...args));
    },
  };

  if (!config.omitAllUnsubscribe) {
    if (!config.omitOff) {
      provider.off = off as unknown as MockCantonProvider['off'];
    }
    provider.removeListener = removeListener as unknown as MockCantonProvider['removeListener'];
  }

  vi.stubGlobal('window', { canton: provider as unknown as SendCantonProvider });
  return provider;
}

/** Remove the mock from `window.canton` and reset all stubs. */
export function uninstallMockCanton(): void {
  vi.unstubAllGlobals();
}

/** Install `window` without a `canton` property (extension not present). */
export function installEmptyWindow(): void {
  vi.stubGlobal('window', {});
}
