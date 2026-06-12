/**
 * Session-lifecycle simulation harness.
 *
 * Drives a REAL `@partylayer/session` store through a controllable CIP-0103
 * provider, so every scenario exercises the store's own machinery — not
 * synthetic shortcuts:
 *   - `expire()`            advances the store's REAL expiry timer (the
 *                           `session:expired` / `onReauthRequired` path); it never
 *                           emits a fake `session:expired`. Requires fake-timer
 *                           control via `advanceTimers` (the store arms expiry
 *                           with `setTimeout`).
 *   - `dropConnection()` /  emit the provider's real `statusChanged` CIP-0103
 *     `restoreConnection()` event — the same signal a live wallet sends — driving
 *                           the store's transient-disconnect / reconnect path.
 *   - `switchParty()`       emits a real `accountsChanged` with a new primary,
 *                           driving the store's `party:changed` detection.
 *   - `openTab()`           returns a second harness whose store shares this
 *                           harness's in-memory BroadcastChannel hub, so a
 *                           disconnect in one tab propagates to the other.
 *
 * Lifecycle: each harness OWNS its own store; `destroy()` is per-harness (a
 * child from `openTab()` must be destroyed by the caller — it is not torn down
 * with its parent).
 */
import {
  createSessionStore,
  createMemoryStorage,
  type BroadcastChannelLike,
  type ChannelFactory,
  type ExpiryOptions,
  type RetryPolicy,
  type SessionAccount,
  type SessionState,
  type SessionStore,
} from '@partylayer/session';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { scenarioToError, type MockScenario } from './scenarios';

export interface SessionHarnessConfig {
  /** Initial primary party id. Default `party::harness-1`. */
  partyId?: string;
  /** CAIP-2 network id reported by the provider. Default `canton:da-devnet`. */
  networkId?: string;
  /** Expiry TTL (ms) armed on connect. Default `60_000`. Drive it with `expire()`. */
  ttlMs?: number;
  /** App re-auth hook invoked by the store's real expiry path. */
  onReauthRequired?: ExpiryOptions['onReauthRequired'];
  /** Reconnect policy passed straight to the store (default: store default). */
  reconnect?: RetryPolicy | false;
  /**
   * Advance timers to fire the store's REAL `setTimeout`-based expiry/backoff —
   * e.g. `vi.advanceTimersByTimeAsync`. Required for `expire()` and for
   * deterministic reconnect timing. Omit only if you don't call `expire()`.
   */
  advanceTimers?: (ms: number) => void | Promise<void>;
  /** @internal shared multi-tab hub (set by `openTab`). */
  _hub?: ChannelHub;
}

export interface SessionHarness {
  /** The live session store under test. */
  readonly store: SessionStore;
  /** The controllable CIP-0103 provider backing the store. */
  readonly provider: CIP0103Provider;
  /** Connect via the real store flow (arms the expiry timer). */
  connect(): Promise<SessionState>;
  /** Fire a real transient `statusChanged(false)` (NOT an explicit disconnect). */
  dropConnection(): void;
  /** Fire a real `statusChanged(true)` to restore the connection. */
  restoreConnection(): void;
  /** Fire a real `accountsChanged` with a new primary → `party:changed`. */
  switchParty(partyId: string): void;
  /** Advance the store's REAL expiry timer past its TTL (no synthetic emit). */
  expire(): Promise<void>;
  /** A second harness sharing this one's broadcast hub (simulates another tab). */
  openTab(config?: Omit<SessionHarnessConfig, '_hub'>): SessionHarness;
  /** Tear down THIS harness's store/provider (per-harness; children are separate). */
  destroy(): void;
}

const DEFAULT_PARTY = 'party::harness-1';
const DEFAULT_NETWORK = 'canton:da-devnet';

function toAccount(partyId: string, networkId: string): CIP0103Account {
  return {
    primary: true,
    partyId,
    status: 'allocated' as CIP0103Account['status'],
    hint: 'harness',
    publicKey: 'pk',
    namespace: 'ns',
    networkId,
    signingProviderId: 'webauthn-prf',
  };
}

/** A synchronous in-memory BroadcastChannel hub shared across tabs. */
export interface ChannelHub {
  factory: ChannelFactory;
}

/** Build a hub whose channels deliver to OTHER instances only (no echo to sender). */
export function createChannelHub(): ChannelHub {
  const instances = new Set<BroadcastChannelLike & { _name: string }>();
  const factory: ChannelFactory = (name) => {
    const inst: BroadcastChannelLike & { _name: string } = {
      _name: name,
      onmessage: null,
      postMessage(data) {
        for (const other of instances) {
          if (other !== inst && other._name === name && other.onmessage) other.onmessage({ data });
        }
      },
      close() {
        instances.delete(inst);
      },
    };
    instances.add(inst);
    return inst;
  };
  return { factory };
}

/** Controllable CIP-0103 provider: scriptable status/accounts + real event bus. */
function createControllableProvider(opts: {
  partyId: string;
  networkId: string;
  scenarios?: Partial<Record<'connect' | 'disconnect' | 'status' | 'listAccounts', MockScenario>>;
}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  let connected = false;
  let account = toAccount(opts.partyId, opts.networkId);

  function emit(event: string, ...args: unknown[]): void {
    listeners.get(event)?.forEach((l) => l(...args));
  }

  const provider = {
    on(event: string, listener: (...args: unknown[]) => void) {
      (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(listener);
      return provider;
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(listener);
      return provider;
    },
    async request({ method }: { method: string }) {
      const scenario = opts.scenarios?.[method as 'connect'];
      if (scenario) throw scenarioToError(scenario);
      switch (method) {
        case 'status':
          return { connection: { isConnected: connected }, network: { networkId: opts.networkId } };
        case 'listAccounts':
          return [account];
        case 'connect':
          connected = true;
          return {};
        case 'disconnect':
          connected = false;
          return null;
        case 'getActiveNetwork':
          return { networkId: opts.networkId };
        default:
          return {};
      }
    },
    // ── harness controls (real CIP-0103 events) ──
    _setConnected(v: boolean) {
      connected = v;
      emit('statusChanged', {
        connection: { isConnected: v },
        network: { networkId: opts.networkId },
      });
    },
    _setPrimary(partyId: string) {
      account = toAccount(partyId, opts.networkId);
      emit('accountsChanged', [account]);
    },
  };
  return provider;
}

export function createSessionHarness(config: SessionHarnessConfig = {}): SessionHarness {
  const partyId = config.partyId ?? DEFAULT_PARTY;
  const networkId = config.networkId ?? DEFAULT_NETWORK;
  const ttlMs = config.ttlMs ?? 60_000;
  const hub = config._hub ?? createChannelHub();

  const provider = createControllableProvider({ partyId, networkId });

  const store = createSessionStore(provider as unknown as CIP0103Provider, {
    storage: createMemoryStorage(), // offline, deterministic
    expiry: { ttlMs, onReauthRequired: config.onReauthRequired },
    ...(config.reconnect !== undefined ? { reconnect: config.reconnect } : {}),
    broadcast: { channelFactory: hub.factory },
  });

  function requireAdvance(): NonNullable<SessionHarnessConfig['advanceTimers']> {
    if (!config.advanceTimers) {
      throw new Error(
        'SessionHarness.expire() drives the store\'s real expiry timer — pass `advanceTimers` ' +
          '(e.g. vi.advanceTimersByTimeAsync) and install fake timers.',
      );
    }
    return config.advanceTimers;
  }

  const harness: SessionHarness = {
    store,
    provider: provider as unknown as CIP0103Provider,
    async connect() {
      const state = await store.connect();
      // Establish the initial primary account (real accountsChanged) so a later
      // switchParty() registers a genuine delta rather than an initial set.
      provider._setPrimary(partyId);
      return state;
    },
    dropConnection() {
      provider._setConnected(false); // real statusChanged(false) → transient drop
    },
    restoreConnection() {
      provider._setConnected(true); // real statusChanged(true)
    },
    switchParty(nextPartyId: string) {
      provider._setPrimary(nextPartyId); // real accountsChanged → party:changed
    },
    async expire() {
      const advance = requireAdvance();
      await advance(ttlMs); // fire the store's REAL setTimeout-based expiry
    },
    openTab(childConfig: Omit<SessionHarnessConfig, '_hub'> = {}) {
      return createSessionHarness({ ...childConfig, _hub: hub });
    },
    destroy() {
      store.destroy();
    },
  };
  return harness;
}

/** Re-export for callers building primary-account fixtures. */
export type { SessionAccount };
