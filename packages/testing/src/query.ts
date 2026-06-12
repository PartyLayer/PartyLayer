/**
 * TanStack Query test utilities — `@partylayer/testing/query`.
 *
 * Subpath entry so the main package stays dependency-free for non-Query
 * consumers. `@tanstack/query-core` is an OPTIONAL peer; install it only if you
 * import from here.
 */
import { QueryClient, type QueryClientConfig, type QueryKey } from '@tanstack/query-core';
import {
  createOfflineHarness,
  type OfflineHarness,
} from './offline';
import type { MockWalletConfig } from './mock-wallet';
import type { SessionStoreOptions } from '@partylayer/session';

/** A QueryClient with test-friendly defaults (no retries, no caching window). */
export function createTestQueryClient(overrides?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...overrides,
    defaultOptions: {
      ...overrides?.defaultOptions,
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        ...overrides?.defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...overrides?.defaultOptions?.mutations,
      },
    },
  });
}

export interface QueryStateView<T> {
  readonly data: T | undefined;
  readonly status: 'pending' | 'error' | 'success';
  readonly fetchStatus: 'fetching' | 'paused' | 'idle';
  readonly isInvalidated: boolean;
}

/** Read a query's current cache state (data + status + invalidation flag). */
export function getQueryState<T>(client: QueryClient, key: QueryKey): QueryStateView<T> {
  const state = client.getQueryState<T>(key);
  return {
    data: state?.data,
    status: state?.status ?? 'pending',
    fetchStatus: state?.fetchStatus ?? 'idle',
    isInvalidated: state?.isInvalidated ?? false,
  };
}

/** True when the query at `key` is currently marked invalidated. */
export function expectInvalidated(client: QueryClient, key: QueryKey): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

export interface OptimisticRollback<T> {
  /** The cache value captured before the optimistic write. */
  readonly snapshot: T | undefined;
  /** Apply an optimistic value to the cache. */
  apply(next: T): void;
  /** Restore the captured snapshot (rollback). */
  rollback(): void;
  /** Current cache value at the key. */
  current(): T | undefined;
}

/**
 * Capture a key's value, then drive an optimistic apply → rollback so a test can
 * assert both the optimistic write and that rollback restored the snapshot.
 */
export function trackOptimisticRollback<T>(client: QueryClient, key: QueryKey): OptimisticRollback<T> {
  const snapshot = client.getQueryData<T>(key);
  return {
    snapshot,
    apply(next: T) {
      client.setQueryData<T>(key, next);
    },
    rollback() {
      client.setQueryData<T>(key, snapshot);
    },
    current() {
      return client.getQueryData<T>(key);
    },
  };
}

/** Offline harness (mock wallet + session store) plus a test QueryClient. */
export interface QueryHarness extends OfflineHarness {
  readonly queryClient: QueryClient;
}

/** Query-inclusive composition of {@link createOfflineHarness}. */
export function createQueryHarness(
  config: {
    wallet?: MockWalletConfig;
    session?: Partial<SessionStoreOptions>;
    query?: QueryClientConfig;
  } = {},
): QueryHarness {
  const base = createOfflineHarness({ wallet: config.wallet, session: config.session });
  const queryClient = createTestQueryClient(config.query);
  return {
    ...base,
    queryClient,
    destroy() {
      queryClient.clear();
      base.destroy();
    },
  };
}
