// @vitest-environment jsdom
/**
 * usePartyState: the party-focused reactive state hook. Mirrors the session-hooks
 * harness (a mock provider + PartyLayerProvider store), with no DevNet or live
 * wallet. Asserts it reflects the store reactively, is SSR-safe (stable
 * disconnected snapshot with no provider), and agrees with useAccount (since it is
 * built on it).
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { createMockWallet } from '@partylayer/testing';
import type { CIP0103Provider } from '@partylayer/core';
import type { PartyLayerClient } from '@partylayer/sdk';
import { PartyLayerProvider } from '../context';
import { useAccount } from '../session-hooks';
import { usePartyState } from '../use-party-state';

const ACCOUNTS_CHANGED = 'accountsChanged';

function mkAccount(partyId: string, primary = true) {
  return {
    primary,
    partyId,
    status: 'allocated' as const,
    hint: '',
    publicKey: '',
    namespace: '',
    networkId: 'canton:da-devnet',
    signingProviderId: '',
  };
}

/** Minimal fake PartyLayerClient: only what PartyLayerProvider touches. */
function fakeClient(provider: CIP0103Provider): PartyLayerClient {
  return {
    asProvider: () => provider,
    getActiveSession: async () => null,
    listWallets: async () => [],
    on: () => () => {},
  } as unknown as PartyLayerClient;
}

function wrapperFor(client: PartyLayerClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(PartyLayerProvider, { client, children });
  };
}

describe('usePartyState', () => {
  it('starts disconnected, reflects connect then disconnect reactively', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => usePartyState(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });

    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    expect(result.current.party).toBeNull();
    expect(result.current.account).toBeNull();
    expect(result.current.status).toBe('disconnected');

    await act(async () => {
      await provider.request({ method: 'connect' });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isDisconnected).toBe(false);
    expect(result.current.party).toBe('party::mock-1');
    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.networkId).toEqual(expect.stringContaining('canton:'));
    expect(result.current.lastError).toBeNull();

    await act(async () => {
      await provider.request({ method: 'disconnect' });
    });

    expect(result.current.isDisconnected).toBe(true);
    expect(result.current.party).toBeNull();
    expect(result.current.account).toBeNull();
  });

  it('reflects accountsChanged reactively (active party + account list update)', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => usePartyState(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });

    act(() => {
      provider.emit(ACCOUNTS_CHANGED, [
        mkAccount('party::switched', true),
        mkAccount('party::second', false),
      ]);
    });

    expect(result.current.accounts).toHaveLength(2);
    expect(result.current.party).toBe('party::switched');
  });

  it('agrees with useAccount on the shared fields (same underlying store state)', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(
      () => ({ party: usePartyState(), account: useAccount() }),
      { wrapper: wrapperFor(fakeClient(provider)) },
    );
    await waitFor(() => expect(result.current.party.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });

    const p = result.current.party;
    const a = result.current.account;
    expect(p.party).toBe(a.party);
    expect(p.account).toBe(a.account);
    expect(p.accounts).toBe(a.accounts);
    expect(p.status).toBe(a.status);
    expect(p.isConnected).toBe(a.isConnected);
    expect(p.isDisconnected).toBe(a.isDisconnected);
    expect(p.networkId).toBe(a.networkId);
    expect(p.lastError).toBe(a.lastError);
  });

  it('presents a party-focused surface (omits useAccount wagmi keys: address, chain, connecting flags)', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => usePartyState(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));

    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual(
      ['account', 'accounts', 'isConnected', 'isDisconnected', 'lastError', 'networkId', 'party', 'status'].sort(),
    );
  });

  it('SSR-safe baseline: the stable disconnected snapshot before any connect', async () => {
    // The disconnected snapshot is what server render / hydration produces. Inside
    // a provider, before connect, the hook reports it: party null, accounts empty,
    // no error. This is inherited from useAccount's stable snapshot.
    const provider = createMockWallet();
    const { result } = renderHook(() => usePartyState(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    expect(result.current.party).toBeNull();
    expect(result.current.account).toBeNull();
    expect(result.current.accounts).toEqual([]);
    expect(result.current.lastError).toBeNull();
  });
});
