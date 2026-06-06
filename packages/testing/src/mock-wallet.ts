/**
 * Mock CIP-0103 wallet provider.
 *
 * `createMockWallet(config)` returns a real, CIP-0103-compliant
 * `CIP0103Provider`. It is built by wrapping a configurable in-memory client
 * in the repo's canonical `createProviderBridge` from `@partylayer/provider`,
 * so the default/happy config passes `runCIP0103ConformanceTests` by
 * construction (it IS the conformance reference implementation, just with a
 * mock backend instead of a live wallet).
 *
 * Failure scenarios are toggled per-method (see ./scenarios). A test can make
 * `connect` succeed while `submitTransaction` fails, etc.
 *
 * Everything here is in-memory and synchronous-by-default — no DevNet, no live
 * wallet, no network. Optional per-method `delays` use `setTimeout` and are
 * fake-timer friendly (see ./offline).
 */

import type { CIP0103Provider } from '@partylayer/core';
import { createProviderBridge } from '@partylayer/provider';
import { scenarioToError, type MockScenario } from './scenarios';

/**
 * The client shape `createProviderBridge` accepts. `@partylayer/provider` does
 * not export its `BridgeableClient` type publicly, so we derive it from the
 * factory signature — this stays correct automatically if the bridge's
 * contract changes, and contextually types the mock object literal below.
 */
export type MockWalletClient = Parameters<typeof createProviderBridge>[0];

/** Methods on the mock client that can carry a scenario / delay. */
export type MockMethod =
  | 'connect'
  | 'disconnect'
  | 'getActiveSession'
  | 'signMessage'
  | 'signTransaction'
  | 'submitTransaction'
  | 'ledgerApi';

export interface MockWalletConfig {
  /** Party id reported by the mock session/accounts. */
  partyId?: string;
  /** Network id the bridge maps to CAIP-2 (e.g. 'devnet'). */
  network?: string;
  /** Whether a session is already active before `connect()` is called. */
  connected?: boolean;
  /** Per-method failure scenarios. Absent ⇒ that method succeeds. */
  scenarios?: Partial<Record<MockMethod, MockScenario>>;
  /** Per-method artificial delay in ms (fake-timer friendly). Default 0. */
  delays?: Partial<Record<MockMethod, number>>;
}

const DEFAULT_PARTY = 'party::mock-1';
const DEFAULT_NETWORK = 'devnet';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the underlying `BridgeableClient`. Exposed as an extension point for
 * tests that want to wrap it differently or inspect it; most callers should
 * use `createMockWallet` instead.
 */
export function createMockWalletClient(config: MockWalletConfig = {}): MockWalletClient {
  const partyId = config.partyId ?? DEFAULT_PARTY;
  const network = config.network ?? DEFAULT_NETWORK;
  let connected = config.connected ?? false;

  const handlers = new Map<string, Set<(event: unknown) => void>>();

  function makeSession() {
    return {
      sessionId: 'sess-mock-1',
      walletId: 'mock',
      partyId,
      network,
      expiresAt: Number.MAX_SAFE_INTEGER,
      capabilitiesSnapshot: [
        'connect',
        'signMessage',
        'signTransaction',
        'submitTransaction',
        'ledgerApi',
      ],
    };
  }

  /** Apply the configured delay, then throw the configured scenario (if any). */
  async function gate(method: MockMethod): Promise<void> {
    const delay = config.delays?.[method];
    if (delay && delay > 0) await wait(delay);
    const scenario = config.scenarios?.[method];
    if (scenario) throw scenarioToError(scenario);
  }

  function fire(event: string, payload: unknown): void {
    handlers.get(event)?.forEach((handler) => handler(payload));
  }

  return {
    async connect() {
      await gate('connect');
      connected = true;
      const session = makeSession();
      fire('session:connected', { type: 'session:connected', session });
      return session;
    },
    async disconnect() {
      await gate('disconnect');
      connected = false;
      fire('session:disconnected', { type: 'session:disconnected' });
    },
    async getActiveSession() {
      await gate('getActiveSession');
      return connected ? makeSession() : null;
    },
    async signMessage() {
      await gate('signMessage');
      return { signature: 'mock-signature' };
    },
    async signTransaction() {
      await gate('signTransaction');
      return {
        transactionHash: 'mock-tx-hash',
        signedTx: { data: 'mock-signed-payload' },
        partyId,
      };
    },
    async submitTransaction() {
      await gate('submitTransaction');
      return {
        transactionHash: 'mock-tx-hash',
        submittedAt: 0,
        commandId: 'mock-command-1',
        updateId: 'mock-update-1',
      };
    },
    async ledgerApi(params) {
      await gate('ledgerApi');
      return {
        response: JSON.stringify({
          requestMethod: params.requestMethod,
          resource: params.resource,
        }),
      };
    },
    getRegistryStatus() {
      return null;
    },
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as (event: unknown) => void);
      return () => {
        handlers.get(event)?.delete(handler as (event: unknown) => void);
      };
    },
  };
}

/**
 * Create a CIP-0103-compliant mock provider.
 *
 * Default config ⇒ a fully conformant happy-path provider. Pass `scenarios`
 * to make specific methods fail with the repo's existing error codes.
 *
 * @example
 *   const provider = createMockWallet();                       // happy path
 *   const provider = createMockWallet({                        // connect ok, submit fails
 *     scenarios: { submitTransaction: 'synchronizerError' },
 *   });
 */
export function createMockWallet(config: MockWalletConfig = {}): CIP0103Provider {
  return createProviderBridge(createMockWalletClient(config));
}
