/**
 * Shared test doubles.
 *
 * The provider double is faithful to what the session store actually reads, which is not
 * obvious from the CIP-0103 types alone: `status` is consumed as
 * `status.connection.isConnected` and `status.network.networkId`
 * (packages/session/src/store.ts), and the account list arrives as the first argument of
 * an `accountsChanged` event rather than from a call. Getting this wrong produces a store
 * stuck in `reconnecting`, so it lives in one place rather than being retyped per file.
 */
import { vi } from 'vitest';
import type { PartyLayerClient, WalletInfo } from '@partylayer/sdk';
import type { RNAsyncStorage } from '../types';

export const ACCOUNT = { partyId: 'party::a' };
export const NETWORK_ID = 'canton:devnet';

export function makeProvider() {
  let isConnected = false;
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of listeners.get(event) ?? []) handler(...args);
  };
  const statusPayload = () => ({
    connection: { isConnected },
    network: { networkId: NETWORK_ID },
  });

  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'status') return statusPayload();
      if (method === 'listAccounts') return isConnected ? [ACCOUNT] : [];
      if (method === 'getActiveNetwork') return { networkId: NETWORK_ID };
      if (method === 'connect') {
        isConnected = true;
        // Real providers report the status change and then the accounts, so the store's
        // accounts-after-status ordering is exercised rather than bypassed.
        emit('statusChanged', statusPayload());
        emit('accountsChanged', [ACCOUNT]);
        return statusPayload();
      }
      if (method === 'disconnect') {
        isConnected = false;
        emit('statusChanged', statusPayload());
        emit('accountsChanged', []);
        return undefined;
      }
      return undefined;
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, (listeners.get(event) ?? []).filter((h) => h !== handler));
    }),
    emit,
  };
}

export const WALLET = {
  walletId: 'console',
  name: 'Console',
  icons: { md: 'https://cdn/console.png' },
} as unknown as WalletInfo;

export function makeClient(overrides: Record<string, unknown> = {}): PartyLayerClient {
  return {
    getActiveSession: vi.fn().mockResolvedValue(null),
    listWallets: vi.fn().mockResolvedValue([WALLET]),
    connect: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn().mockResolvedValue(undefined),
    signMessage: vi.fn().mockResolvedValue({ signature: 'sig' }),
    signTransaction: vi.fn().mockResolvedValue({ signedTx: 'tx' }),
    submitTransaction: vi.fn().mockResolvedValue({ transactionHash: '0xabc' }),
    ledgerApi: vi.fn().mockResolvedValue({ ok: true }),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    asProvider: vi.fn(() => makeProvider()),
    ...overrides,
  } as unknown as PartyLayerClient;
}

/** A Map-backed AsyncStorage that outlives a provider, so it can model an app restart. */
export function makeAsyncStorage(backing = new Map<string, string>()) {
  const storage: RNAsyncStorage = {
    getItem: async (key) => (backing.has(key) ? (backing.get(key) as string) : null),
    setItem: async (key, value) => {
      backing.set(key, value);
    },
    removeItem: async (key) => {
      backing.delete(key);
    },
    clear: async () => {
      backing.clear();
    },
  };
  return { storage, backing };
}
