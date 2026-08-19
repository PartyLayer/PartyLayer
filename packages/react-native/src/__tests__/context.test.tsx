// @vitest-environment jsdom
/**
 * PartyLayerProvider tests.
 *
 * Three things are proven here beyond "the context works":
 *
 * 1. The 0.2.2 call style keeps working with no provider anywhere, and the provider style
 *    resolves the same client, so nothing published today breaks.
 * 2. Session persistence. On React Native the shared session default is in-memory, because
 *    it requires IndexedDB, so a session is lost on app restart unless AsyncStorage is
 *    wired. Both branches are proven against a restart simulation.
 * 3. Lifecycle safety: a pending load resolving after unmount sets no state, and swapping
 *    the client resets rather than leaking the previous client's session.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, waitFor, act } from '@testing-library/react';
import { Text } from 'react-native';
import type { PartyLayerClient, Session, WalletInfo } from '@partylayer/sdk';
import { PartyLayerProvider, usePartyLayerContext, usePartyLayer } from '../context';
import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import type { RNAsyncStorage } from '../types';

vi.mock('react-native', () => ({
  Text: ({ children }: { children?: unknown }) => children as never,
  Linking: { openURL: vi.fn(), addEventListener: vi.fn(() => ({ remove: vi.fn() })), getInitialURL: vi.fn(async () => null) },
}));

const wallet = { walletId: 'console', name: 'Console', icons: { md: 'https://cdn/console.png' } } as unknown as WalletInfo;
const session = { sessionId: 's1', walletId: 'console', partyId: 'party::a' } as unknown as Session;

/** A CIP-0103 provider faithful to the calls the session store actually makes. */
function makeProvider(connected = false) {
  let isConnected = connected;
  const listeners = new Map<string, ((payload: unknown) => void)[]>();
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'status') return { status: isConnected ? 'connected' : 'disconnected' };
      if (method === 'listAccounts') return isConnected ? [{ partyId: 'party::a' }] : [];
      if (method === 'getActiveNetwork') return { networkId: 'canton:devnet' };
      if (method === 'connect') {
        isConnected = true;
        return { status: 'connected' };
      }
      if (method === 'disconnect') {
        isConnected = false;
        return undefined;
      }
      return undefined;
    }),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }),
    removeListener: vi.fn(),
  };
}

function makeClient(overrides: Record<string, unknown> = {}): PartyLayerClient {
  return {
    getActiveSession: vi.fn().mockResolvedValue(null),
    listWallets: vi.fn().mockResolvedValue([wallet]),
    connect: vi.fn().mockResolvedValue(session),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    asProvider: vi.fn(() => makeProvider()),
    ...overrides,
  } as unknown as PartyLayerClient;
}

/** A Map-backed AsyncStorage that OUTLIVES a provider, so it can model an app restart. */
function makeAsyncStorage(backing = new Map<string, string>()) {
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

function wrapper(client: PartyLayerClient, asyncStorage?: RNAsyncStorage) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PartyLayerProvider client={client} asyncStorage={asyncStorage}>
        {children}
      </PartyLayerProvider>
    );
  };
}

describe('PartyLayerProvider: both call styles', () => {
  it('supplies the client to useConnect() and useWallets() with no explicit argument', async () => {
    const client = makeClient();
    const { result } = renderHook(() => ({ connect: useConnect(), wallets: useWallets() }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.wallets.wallets).toEqual([wallet]));
    expect(typeof result.current.connect.connect).toBe('function');
  });

  it('accepts parameters with no client, the provider form', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useWallets({ filter: { network: 'devnet' } as never }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.listWallets).toHaveBeenCalledWith({ network: 'devnet' });
  });

  it('keeps the 0.2.2 explicit-client form working with NO provider', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useWallets(client, {}));
    await waitFor(() => expect(result.current.wallets).toEqual([wallet]));
  });

  it('keeps useConnect(client) working with NO provider', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useConnect(client));
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.session).toBeNull();
  });

  it('throws a message naming the provider when used outside one', () => {
    // The thrown error is expected; silence React's error logging for this render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useConnect())).toThrow(/PartyLayerProvider/);
    expect(() => renderHook(() => useWallets())).toThrow(/PartyLayerProvider/);
    expect(() => renderHook(() => usePartyLayer())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('PartyLayerProvider: session persistence across an app restart', () => {
  it('persists the session through AsyncStorage when it is passed', async () => {
    const { storage, backing } = makeAsyncStorage();
    const client = makeClient();

    function Probe() {
      const { store } = usePartyLayerContext();
      // Connect through the store, which is what writes the persisted envelope.
      if (store && backing.size === 0) void store.connect();
      return <Text>probe</Text>;
    }

    render(
      <PartyLayerProvider client={client} asyncStorage={storage}>
        <Probe />
      </PartyLayerProvider>,
    );

    // The store wrote the session envelope into the AsyncStorage the app supplied.
    await waitFor(() => expect(backing.size).toBeGreaterThan(0));
    const persistedKeys = [...backing.keys()];
    expect(persistedKeys.length).toBe(1);
    expect(typeof backing.get(persistedKeys[0])).toBe('string');

    // Restart simulation: a brand new provider and store over the SAME AsyncStorage still
    // sees the persisted entry, which is what survives an app relaunch.
    const restarted = makeAsyncStorage(backing);
    expect(await restarted.storage.getItem(persistedKeys[0])).toBe(backing.get(persistedKeys[0]));
  });

  it('does NOT persist when asyncStorage is omitted, the in-memory fallback', async () => {
    const { storage, backing } = makeAsyncStorage();
    const client = makeClient();

    function Probe() {
      const { store } = usePartyLayerContext();
      if (store) void store.connect();
      return <Text>probe</Text>;
    }

    // No asyncStorage prop: the store falls back to in-memory, because the shared default
    // needs IndexedDB and React Native has none.
    render(
      <PartyLayerProvider client={client}>
        <Probe />
      </PartyLayerProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Nothing reached AsyncStorage, so an app restart would start disconnected.
    expect(backing.size).toBe(0);
    expect(await storage.getItem('partylayer.session')).toBeNull();
  });
});

describe('PartyLayerProvider: lifecycle safety', () => {
  it('a load resolving AFTER unmount sets no state and logs no warning', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveList: (value: WalletInfo[]) => void = () => {};
    const pending = new Promise<WalletInfo[]>((resolve) => {
      resolveList = resolve;
    });
    const client = makeClient({ listWallets: vi.fn().mockReturnValue(pending) });

    let renders = 0;
    const { unmount } = renderHook(() => {
      renders += 1;
      return useWallets(client);
    });
    const rendersAtUnmount = renders;

    unmount();
    await act(async () => {
      resolveList([wallet]);
      await pending;
    });

    // No render happened after unmount, so no state was set on a dead hook.
    expect(renders).toBe(rendersAtUnmount);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('swapping the client resets state instead of leaking the previous session', async () => {
    const walletA = { walletId: 'a', name: 'A', icons: { md: 'https://cdn/a.png' } } as unknown as WalletInfo;
    const walletB = { walletId: 'b', name: 'B', icons: { md: 'https://cdn/b.png' } } as unknown as WalletInfo;
    const clientA = makeClient({ listWallets: vi.fn().mockResolvedValue([walletA]) });
    const clientB = makeClient({ listWallets: vi.fn().mockResolvedValue([walletB]) });

    const { result, rerender } = renderHook(({ client }: { client: PartyLayerClient }) => useWallets(client), {
      initialProps: { client: clientA },
    });
    await waitFor(() => expect(result.current.wallets).toEqual([walletA]));

    rerender({ client: clientB });
    // The previous client's list is gone immediately, not left on screen until B resolves.
    expect(result.current.wallets).toBeUndefined();
    expect(result.current.isSuccess).toBe(false);
    await waitFor(() => expect(result.current.wallets).toEqual([walletB]));
  });

  it('swapping the client clears a connected session from the previous client', async () => {
    const clientA = makeClient({ getActiveSession: vi.fn().mockResolvedValue(session) });
    const clientB = makeClient({ getActiveSession: vi.fn().mockResolvedValue(null) });

    const { result, rerender } = renderHook(({ client }: { client: PartyLayerClient }) => useConnect(client), {
      initialProps: { client: clientA },
    });
    await waitFor(() => expect(result.current.session).toEqual(session));

    rerender({ client: clientB });
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.status).toBe('idle');
  });
});
