/**
 * One public Canton DiscoveryClient owns native providers. PartyLayer keeps only
 * a live identity projection and boundary checks, never a second native session.
 * This module uses no vendor internals or wallet-specific transport classes.
 */
import type { DiscoveryClient, ProviderAdapter } from '@canton-network/core-wallet-discovery';
import type {
  CIP0103Account,
  CIP0103Provider,
  NetworkId,
  OfficialProviderAdapter,
  WalletAdapter,
} from '@partylayer/core';
import { detectNetworkMismatch, isRecognizedNetwork } from '@partylayer/core';
import { assertConnectionAccepted, assertPrimaryParty } from './connection-result';

export interface NativeIdentity {
  account: CIP0103Account;
  network: NetworkId;
  status?: {
    isConnected?: boolean;
    connection?: { isConnected?: boolean };
    network?: { networkId?: string };
  };
}

interface Registration {
  id: string;
  source: OfficialProviderAdapter;
  network: NetworkId;
  /** A saved identity is only a constraint; it cannot create a connection. */
  expected?: { partyId: string; network: NetworkId };
}

interface Operation {
  abort: AbortController;
  id?: string;
  identity?: NativeIdentity;
}

const SILENT_PROBE_TIMEOUT_MS = 10_000;

function disconnected(): Error {
  return new Error('Native wallet connection is no longer active');
}

function teardown(source: { teardown?: () => void } | undefined): void {
  try {
    source?.teardown?.();
  } catch {
    /* A transport cleanup must not retain a live owner. */
  }
}

/** Abort the wait even when a vendor's RPC does not implement cancellation. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(disconnected());
    if (signal.aborted) {
      reject(disconnected());
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readIdentity(
  provider: CIP0103Provider,
  registration: Registration,
  signal: AbortSignal
): Promise<NativeIdentity> {
  const account = await abortable(
    provider.request<CIP0103Account>({ method: 'getPrimaryAccount' }),
    signal
  );
  assertPrimaryParty(account);
  let status: NativeIdentity['status'];
  try {
    status = await abortable(provider.request({ method: 'status' }), signal);
  } catch (error) {
    if (signal.aborted) throw error; /* Account-only providers are supported. */
  }
  if (status?.isConnected === false || status?.connection?.isConnected === false)
    throw disconnected();
  const network =
    [status?.network?.networkId, account.networkId, registration.network].find(
      (value): value is NetworkId => typeof value === 'string' && isRecognizedNetwork(value)
    ) ?? registration.network;
  if (
    registration.expected &&
    (account.partyId !== registration.expected.partyId ||
      detectNetworkMismatch(registration.expected.network, network))
  )
    throw disconnected();
  if (signal.aborted) throw disconnected();
  return { account, network, status };
}

export class NativeConnectionOwner {
  private client: DiscoveryClient | null = null;
  private initialization: Promise<void> | null = null;
  private readonly registrations = new Map<string, Registration>();
  private operation: Operation | null = null;
  private pending: Promise<unknown> | null = null;
  private closing: Promise<void> | null = null;
  private projection: { id: string; identity: NativeIdentity } | null = null;
  private unsubscribers: (() => void)[] = [];
  private disposed = false;
  private refreshRevision = 0;
  private identityRefreshing = false;
  private readonly probes = new Set<AbortController>();

  constructor(
    private readonly changed: (id: string, identity: NativeIdentity | null) => void = () => {}
  ) {}

  get busy(): boolean {
    return this.operation !== null || this.closing !== null;
  }

  assertAvailable(): void {
    if (this.disposed) throw disconnected();
    if (this.busy) throw new Error('A native wallet operation is already in progress');
  }

  /** Run during picker preparation, never between a click and provider.connect. */
  async prepare(id: string, source: OfficialProviderAdapter, network: NetworkId): Promise<void> {
    if (this.disposed) throw disconnected();
    this.registrations.set(id, { id, source, network });
    if (!this.initialization) {
      this.initialization = (async () => {
        const { DiscoveryClient } = await import('@canton-network/core-wallet-discovery');
        const client = await DiscoveryClient.create({ adapters: [] });
        if (this.disposed) {
          client.destroy();
          return;
        }
        this.client = client;
      })();
    }
    await this.initialization;
    if (this.disposed || !this.client) throw disconnected();
    for (const registration of this.registrations.values())
      this.client.registerAdapter(this.wrap(registration));
  }

  private wrap(registration: Registration): ProviderAdapter {
    const source = registration.source;
    return {
      providerId: registration.id,
      name: source.name,
      type:
        source.type === 'desktop' || source.type === 'mobile' || source.type === 'remote'
          ? source.type
          : 'browser',
      icon: source.icon,
      getInfo: () => ({
        providerId: registration.id,
        name: source.name,
        type: 'browser',
        icon: source.icon,
      }),
      detect: () => source.detect(),
      provider: () => this.guard(source.provider() as CIP0103Provider, registration),
      teardown: () => teardown(source),
      restore: async () => {
        const operation = this.operation;
        if (!operation) throw disconnected();
        // A provider without restore can still prove an existing injected session
        // silently. Never send connect() from restoration.
        try {
          const raw = source.restore
            ? await abortable(source.restore(), operation.abort.signal)
            : source.provider();
          if (!raw) return null;
          const provider = raw as CIP0103Provider;
          operation.identity = await readIdentity(provider, registration, operation.abort.signal);
          return this.guard(provider, registration) as ReturnType<ProviderAdapter['provider']>;
        } catch (error) {
          teardown(source);
          throw error;
        }
      },
    };
  }

  private guard(
    raw: CIP0103Provider,
    registration: Registration
  ): ReturnType<ProviderAdapter['provider']> {
    const provider: CIP0103Provider = {
      request: async <T>(args: Parameters<CIP0103Provider['request']>[0]): Promise<T> => {
        if (this.disposed) throw disconnected();
        if (args.method !== 'connect') {
          if (this.client?.getActiveSession()?.provider !== provider) throw disconnected();
          if (!this.projection && args.method !== 'disconnect') throw disconnected();
          if (
            this.identityRefreshing &&
            ![
              'status',
              'getPrimaryAccount',
              'listAccounts',
              'getActiveNetwork',
              'isConnected',
            ].includes(args.method)
          ) {
            throw new Error('Native wallet identity is being refreshed');
          }
          const result = await (args.method === 'disconnect' && this.operation
            ? abortable(raw.request<T>(args), this.operation.abort.signal)
            : raw.request<T>(args));
          if (args.method === 'status') {
            const status = result as NativeIdentity['status'];
            if (status?.isConnected === false || status?.connection?.isConnected === false) {
              this.invalidate(registration.id);
            }
          }
          return result;
        }
        const operation = this.operation;
        if (!operation || operation.abort.signal.aborted) throw disconnected();
        // raw.request is invoked before the first await: hosted wallet popups
        // retain the explicit click's user activation.
        const response = await abortable(raw.request<T>(args), operation.abort.signal);
        assertConnectionAccepted(response);
        operation.identity = await readIdentity(raw, registration, operation.abort.signal);
        return response;
      },
      on: (event, listener) => {
        raw.on(event, listener);
        return provider;
      },
      emit: (event, ...args) => raw.emit(event, ...args),
      removeListener: (event, listener) => {
        raw.removeListener(event, listener);
        return provider;
      },
    };
    return provider as ReturnType<ProviderAdapter['provider']>;
  }

  /** No await precedes the official client's connect call. */
  connect(id: string, signal?: AbortSignal): Promise<NativeIdentity> {
    this.assertAvailable();
    if (!this.client || !this.registrations.has(id))
      return Promise.reject(new Error('Native wallet was not prepared'));
    const operation: Operation = { abort: new AbortController(), id };
    this.operation = operation;
    this.detach();
    const previous = this.client.getActiveSession();
    teardown(previous?.adapter);
    const previousId = this.projection?.id;
    this.projection = null;
    if (previousId) this.changed(previousId, null);
    const abort = () => operation.abort.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const task = (async () => {
      try {
        await this.client!.connect(id);
        if (operation.abort.signal.aborted || this.disposed || !operation.identity)
          throw disconnected();
        this.projection = { id, identity: operation.identity };
        this.attach(id);
        return operation.identity;
      } catch (error) {
        // Public destroy clears the official in-memory owner. A later prepare
        // rebuilds it; no private fields or localStorage keys are modified.
        this.client?.destroy();
        this.client = null;
        this.initialization = null;
        teardown(this.registrations.get(id)?.source);
        throw error;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (this.operation === operation) this.operation = null;
      }
    })();
    this.pending = task;
    void task.then(
      () => {
        if (this.pending === task) this.pending = null;
      },
      () => {
        if (this.pending === task) this.pending = null;
      }
    );
    return task;
  }

  async restore(expected?: {
    id: string;
    partyId: string;
    network: NetworkId;
  }): Promise<{ id: string; identity: NativeIdentity } | null> {
    if (!this.client || this.projection || this.busy || this.disposed) return this.getSession();
    const registration = expected && this.registrations.get(expected.id);
    if (registration) registration.expected = expected;
    const operation: Operation = { abort: new AbortController() };
    this.operation = operation;
    const timeout = setTimeout(() => operation.abort.abort(), SILENT_PROBE_TIMEOUT_MS);
    const task = (async () => {
      try {
        await this.client!.restorePersistedSessionIfNeeded();
        const active = this.client?.getActiveSession();
        if (!active || !operation.identity || operation.abort.signal.aborted || this.disposed)
          return null;
        if (expected && active.providerId !== expected.id) {
          teardown(active.adapter);
          this.client!.destroy();
          this.client = null;
          this.initialization = null;
          return null;
        }
        const id = String(active.providerId);
        this.projection = { id, identity: operation.identity };
        this.attach(id);
        return this.getSession();
      } finally {
        clearTimeout(timeout);
        if (registration) delete registration.expected;
        if (this.operation === operation) this.operation = null;
      }
    })();
    this.pending = task;
    try {
      return await task;
    } finally {
      if (this.pending === task) this.pending = null;
    }
  }

  getSession(): { id: string; identity: NativeIdentity } | null {
    if (this.disposed || !this.client?.getActiveSession() || !this.projection) return null;
    return this.projection;
  }

  getProvider(id?: string): CIP0103Provider {
    if (!this.getSession() || (id && this.projection?.id !== id)) throw disconnected();
    return this.client!.getProvider() as CIP0103Provider;
  }

  /** A bare signature must not be attributed to an old, eventless primary party. */
  async validateIdentity(id: string, partyId: string, network: NetworkId): Promise<void> {
    const provider = this.getProvider(id);
    const revision = ++this.refreshRevision;
    this.identityRefreshing = true;
    let verified = false;
    try {
      const identity = await this.probe(provider, this.registrations.get(id)!);
      if (revision !== this.refreshRevision || this.getProvider(id) !== provider)
        throw disconnected();
      verified = true;
      this.projection = { id, identity };
      if (
        identity.account.partyId !== partyId ||
        detectNetworkMismatch(network, identity.network)
      ) {
        this.changed(id, identity);
        throw new Error('Wallet identity changed during message signing');
      }
    } catch (error) {
      if (!verified && revision === this.refreshRevision) this.invalidate(id);
      throw error;
    } finally {
      if (revision === this.refreshRevision) this.identityRefreshing = false;
    }
  }

  private async probe(
    provider: CIP0103Provider,
    registration: Registration
  ): Promise<NativeIdentity> {
    const abort = new AbortController();
    this.probes.add(abort);
    const timeout = setTimeout(() => abort.abort(), SILENT_PROBE_TIMEOUT_MS);
    try {
      return await readIdentity(provider, registration, abort.signal);
    } finally {
      clearTimeout(timeout);
      this.probes.delete(abort);
    }
  }

  private detach(): void {
    ++this.refreshRevision;
    this.identityRefreshing = false;
    for (const probe of this.probes) probe.abort();
    this.probes.clear();
    this.unsubscribers.splice(0).forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch {
        /* Continue cleanup. */
      }
    });
  }

  private attach(id: string): void {
    const provider = this.getProvider(id);
    const update = (payload: unknown) => {
      const status = payload as NativeIdentity['status'];
      if (
        status?.connection?.isConnected === false ||
        status?.isConnected === false ||
        (Array.isArray(payload) && payload.length === 0)
      ) {
        this.invalidate(id);
        return;
      }
      const revision = ++this.refreshRevision;
      this.identityRefreshing = true;
      const registration = this.registrations.get(id)!;
      void this.probe(provider, registration).then(
        (identity) => {
          if (revision !== this.refreshRevision || this.projection?.id !== id || this.disposed)
            return;
          this.identityRefreshing = false;
          this.projection = { id, identity };
          this.changed(id, identity);
        },
        () => {
          if (revision === this.refreshRevision) this.invalidate(id);
        }
      );
    };
    for (const event of ['accountsChanged', 'statusChanged']) {
      provider.on(event, update);
      this.unsubscribers.push(() => provider.removeListener(event, update));
    }
  }

  private invalidate(id: string): void {
    if (this.projection?.id !== id) return;
    this.detach();
    this.projection = null;
    teardown(this.client?.getActiveSession()?.adapter);
    this.client?.destroy();
    this.client = null;
    this.initialization = null;
    this.changed(id, null);
  }

  /** Local transport cleanup when switching to a proprietary integration. */
  release(): void {
    this.assertAvailable();
    const id = this.projection?.id;
    this.detach();
    this.projection = null;
    teardown(this.client?.getActiveSession()?.adapter);
    this.client?.destroy();
    this.client = null;
    this.initialization = null;
    if (id) this.changed(id, null);
  }

  disconnect(): Promise<void> {
    if (this.closing) return this.closing;
    this.operation?.abort.abort();
    const task = (async () => {
      await this.pending?.catch(() => {});
      this.detach();
      const id = this.projection?.id;
      this.projection = null;
      const operation: Operation = { abort: new AbortController() };
      this.operation = operation;
      const timeout = setTimeout(() => operation.abort.abort(), SILENT_PROBE_TIMEOUT_MS);
      try {
        await this.client?.disconnect();
      } finally {
        clearTimeout(timeout);
        if (this.client?.getActiveSession()) {
          this.client.destroy();
          this.client = null;
          this.initialization = null;
        }
        this.operation = null;
        if (id) this.changed(id, null);
      }
    })();
    this.closing = task;
    void task.then(
      () => {
        if (this.closing === task) this.closing = null;
      },
      () => {
        if (this.closing === task) this.closing = null;
      }
    );
    return task;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.operation?.abort.abort();
    this.detach();
    this.projection = null;
    teardown(this.client?.getActiveSession()?.adapter);
    if (!this.client?.getActiveSession() && this.operation?.id)
      teardown(this.registrations.get(this.operation.id)?.source);
    this.client?.destroy();
    this.client = null;
  }
}

/** Internal binding; public custom adapters retain their compatibility contract. */
export const nativeOwnerBindings = new WeakMap<object, NativeConnectionOwner>();

/** Copy generic wrapper state when a configuration instance is reused by clients. */
export const nativeAdapterCopies = new WeakMap<object, () => WalletAdapter>();
