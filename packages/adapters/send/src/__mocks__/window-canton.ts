/**
 * Reusable test harness for the Send adapter — announce + extension-channel
 * transport.
 *
 * Send is announce-only: it advertises via `canton:announceProvider` and routes
 * RPCs over the splice postMessage `target` channel; it does NOT inject
 * `window.canton` (Console owns that slot). So this harness no longer installs
 * a `window.canton` provider — instead it:
 *   - builds a mock CHANNEL provider (the `request`/`on`/`off` surface a real
 *     extension-channel provider exposes), reusing the captured real fixtures;
 *   - exposes `makeSendProvider()` which wires a `SendProvider` to that channel
 *     via an injected announce-`discover` (so tests need no real postMessage);
 *   - models the live collision by parking a Console-class provider at
 *     `window.canton` while Send is reached purely via announce.
 *
 * The fixtures below are NOT invented — captured from a real Send extension.
 */

import { vi } from 'vitest';

import type { CIP0103Provider, ProviderDetection } from '@partylayer/core';
import type { AnnounceDiscoveryOptions, DiscoveredProvider } from '@partylayer/provider';

import { SEND_KERNEL_ID } from '../constants';
import { SendProvider } from '../send-provider';
import type {
  SendAccount,
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

/** A non-Send extension id (Console's), used to model the shared-slot collision. */
export const FOREIGN_KERNEL_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

// ── RPC error helpers ──────────────────────────────────────────────────────

export interface MockRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export function rpcError(code: number, message: string, data?: unknown): MockRpcError {
  return { code, message, data };
}

// ── Channel-provider mock ───────────────────────────────────────────────────

export interface MockProviderConfig {
  /** Announce id Send advertises with (== target). Defaults to SEND_KERNEL_ID. */
  announceId?: string;
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
 * Mock channel provider. `request`/`on`/`off` are `vi.fn()` so tests can assert
 * call args (same shape as the previous window.canton mock). It satisfies the
 * `CIP0103Provider` surface SendProvider needs (request/on/emit/removeListener).
 */
export interface MockCantonProvider {
  request: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off?: ReturnType<typeof vi.fn>;
  removeListener?: ReturnType<typeof vi.fn>;
  emit(event: SendEventName, ...args: unknown[]): void;
  listeners: Map<SendEventName, Set<SendEventListener>>;
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

function buildChannel(config: MockProviderConfig): MockCantonProvider {
  const status: SendStatusResponse = config.status ?? REAL_STATUS;
  const listeners = new Map<SendEventName, Set<SendEventListener>>();

  function maybeThrow(method: SendRpcMethod): void {
    const err = config.errors?.[method];
    if (!err) return;
    throw err; // Error instance or plain RPC-shaped object (exercises code branches)
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
    if (!config.omitOff) provider.off = off as unknown as MockCantonProvider['off'];
    provider.removeListener = removeListener as unknown as MockCantonProvider['removeListener'];
  }

  return provider;
}

// ── Announce harness state ──────────────────────────────────────────────────

let announcedChannel: MockCantonProvider | null = null;
let announcedId: string = SEND_KERNEL_ID;
let discoverCalls = 0;

/** A Console-class provider that owns the shared `window.canton` slot. */
function consoleAtWindowCanton(): unknown {
  return {
    source: 'consoleWallet',
    request: async () => ({}),
    on: () => {},
    emit: () => true,
    removeListener: () => {},
  };
}

/** Injected announce discovery: returns Send's channel entry iff Send "announced". */
async function sendDiscover(_options?: AnnounceDiscoveryOptions): Promise<DiscoveredProvider[]> {
  discoverCalls += 1;
  if (!announcedChannel) return [];
  return [
    {
      id: announcedId,
      provider: announcedChannel as unknown as CIP0103Provider,
      source: 'injected',
      name: 'Send',
    },
  ];
}

/** Number of announce-discovery calls since the last `uninstallMockCanton()`. */
export function getDiscoverCalls(): number {
  return discoverCalls;
}

/**
 * Build a `SendProvider` wired to the mock announce channel (announce timeout 0).
 * Use this in place of the real announce handshake in tests.
 */
export function makeSendProvider(detection?: ProviderDetection): SendProvider {
  return new SendProvider(detection, { discover: sendDiscover, announceTimeoutMs: 0 });
}

/**
 * Mark Send as announcing with the given channel config, and park Console at
 * the shared `window.canton` slot (proving Send is reached via announce
 * regardless of who owns window.canton). Returns the channel mock for assertions.
 */
export function installMockCanton(config: MockProviderConfig = {}): MockCantonProvider {
  const channel = buildChannel(config);
  announcedChannel = channel;
  announcedId = config.announceId ?? SEND_KERNEL_ID;
  vi.stubGlobal('window', { canton: consoleAtWindowCanton() });
  return channel;
}

/** A browser where Send does NOT announce (Console may still own window.canton). */
export function installEmptyWindow(): void {
  announcedChannel = null;
  vi.stubGlobal('window', { canton: consoleAtWindowCanton() });
}

/** Reset the announce harness and restore globals. */
export function uninstallMockCanton(): void {
  announcedChannel = null;
  announcedId = SEND_KERNEL_ID;
  discoverCalls = 0;
  vi.unstubAllGlobals();
}
