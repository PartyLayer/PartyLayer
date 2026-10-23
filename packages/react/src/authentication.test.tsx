// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createAuthenticationChallenge, formatAuthenticationMessage, type AuthenticationIdentity } from '@partylayer/core/authentication';
import { PartyLayerAuthenticationProvider, useAuthentication, type PartyLayerAuthenticationAdapter } from './authentication';
import { ConnectButton } from './connect-button';
import { PartyLayerLocaleProvider } from './localization';

const state = vi.hoisted(() => ({
  session: { walletId: 'console', partyId: 'alice::party', network: 'devnet', networkMismatch: undefined as unknown } as { walletId: string; partyId: string; network: string; networkMismatch?: unknown } | null,
  account: { party: 'alice::party', networkId: 'canton:da-devnet', isConnected: true, isConnecting: false, isReconnecting: false },
  client: { signMessage: vi.fn() }, isLoading: false,
}));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
vi.mock('./session-hooks', () => ({ useAccount: () => state.account }));
vi.mock('./hooks', () => ({
  useClientSession: () => state.session,
  useWallets: () => ({ wallets: [], isLoading: false }),
  useConnect: () => ({ isConnecting: false }),
  useDisconnect: () => ({ disconnect: vi.fn(async () => {}) }),
}));

const identity = { partyId: 'alice::party', networkId: 'canton:da-devnet' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function backend(): PartyLayerAuthenticationAdapter {
  return {
    getSession: vi.fn(async () => null),
    getChallenge: vi.fn(async account => createAuthenticationChallenge({
      ...account, origin: window.location.origin, nonce: 'a'.repeat(43),
    })),
    verify: vi.fn(async () => identity),
    signOut: vi.fn(async () => {}),
  };
}
function setup(adapter = backend(), strict = false) {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const provider = <PartyLayerAuthenticationProvider adapter={adapter}>{children}</PartyLayerAuthenticationProvider>;
    return strict ? <StrictMode>{provider}</StrictMode> : provider;
  };
  return { ...renderHook(useAuthentication, { wrapper }), adapter };
}
beforeEach(() => {
  state.session = { walletId: 'console', partyId: identity.partyId, network: 'devnet' };
  state.account = { party: identity.partyId, networkId: identity.networkId, isConnected: true, isConnecting: false, isReconnecting: false };
  state.isLoading = false;
  state.client.signMessage.mockReset().mockImplementation(async ({ message }: { message: string }) => ({
    message, partyId: state.session?.partyId, signature: 'opaque-wallet-signature',
  }));
});
afterEach(cleanup);

describe('backend authentication lifecycle', () => {
  it('restores an existing matching backend session without asking for a signature, including StrictMode', async () => {
    const adapter = backend();
    vi.mocked(adapter.getSession).mockResolvedValue(identity);
    const view = setup(adapter, true);
    await waitFor(() => expect(view.result.current.status).toBe('authenticated'));
    expect(state.client.signMessage).not.toHaveBeenCalled();
    expect(adapter.signOut).not.toHaveBeenCalled();
  });

  it('signs the exact server challenge and authenticates only after the backend accepts', async () => {
    const view = setup();
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    await act(async () => view.result.current.signIn());
    const challenge = await vi.mocked(view.adapter.getChallenge).mock.results[0].value;
    expect(state.client.signMessage).toHaveBeenCalledWith({ message: formatAuthenticationMessage(challenge) });
    expect(view.adapter.verify).toHaveBeenCalledWith({ nonce: challenge.nonce, signature: 'opaque-wallet-signature' });
    expect(view.result.current.status).toBe('authenticated');
    expect(view.result.current.identity).toEqual(identity);
  });

  it('rejects a challenge for another origin, party or network before opening the wallet', async () => {
    for (const changed of [{ origin: 'https://evil.example' }, { partyId: 'bob::party' }, { networkId: 'canton:da-mainnet' }]) {
      const adapter = backend();
      vi.mocked(adapter.getChallenge).mockResolvedValue(createAuthenticationChallenge({
        ...identity, origin: window.location.origin, nonce: 'b'.repeat(43), ...changed,
      }));
      const view = setup(adapter);
      await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
      await act(async () => { await expect(view.result.current.signIn()).rejects.toThrow(/match/); });
      expect(state.client.signMessage).not.toHaveBeenCalled();
      expect(adapter.verify).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('rejects wallet rejection and unexpected signed bytes without sending a proof', async () => {
    const view = setup();
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    state.client.signMessage.mockRejectedValueOnce(new Error('User rejected'));
    await act(async () => { await expect(view.result.current.signIn()).rejects.toThrow('User rejected'); });
    expect(view.result.current.error?.message).toBe('User rejected');
    state.client.signMessage.mockResolvedValueOnce({ message: 'different', partyId: identity.partyId, signature: 'x' });
    await act(async () => { await expect(view.result.current.signIn()).rejects.toThrow(/unexpected/); });
    expect(view.adapter.verify).not.toHaveBeenCalled();
  });

  it('rejects duplicate clicks and a party switch while the wallet approval is pending', async () => {
    const signing = deferred<{ message: string; partyId: string; signature: string }>();
    state.client.signMessage.mockImplementationOnce(() => signing.promise);
    const view = setup();
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    let first!: Promise<unknown>;
    act(() => { first = view.result.current.signIn().catch(reason => reason); });
    await waitFor(() => expect(state.client.signMessage).toHaveBeenCalled());
    await expect(view.result.current.signIn()).rejects.toThrow(/already pending/);
    state.account = { ...state.account, party: 'bob::party' };
    state.session = { ...state.session!, partyId: 'bob::party' };
    view.rerender();
    const message = state.client.signMessage.mock.calls[0][0].message;
    await act(async () => { signing.resolve({ message, partyId: identity.partyId, signature: 'x' }); await first; });
    expect(view.adapter.verify).not.toHaveBeenCalled();
    expect(view.result.current.status).toBe('unauthenticated');
    expect(view.adapter.signOut).toHaveBeenCalled();
  });

  it('revokes a late server verification after disconnect, and never authenticates the next account', async () => {
    const verification = deferred<AuthenticationIdentity | null>();
    const adapter = backend();
    vi.mocked(adapter.verify).mockReturnValue(verification.promise);
    const view = setup(adapter);
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    let signing!: Promise<unknown>;
    act(() => { signing = view.result.current.signIn().catch(reason => reason); });
    await waitFor(() => expect(adapter.verify).toHaveBeenCalled());
    state.session = null;
    state.account = { ...state.account, isConnected: false };
    view.rerender();
    expect(view.result.current.identity).toBeNull();
    await act(async () => { verification.resolve(identity); await signing; });
    await waitFor(() => expect(adapter.signOut).toHaveBeenCalled());
    expect(view.result.current.status).toBe('unauthenticated');
  });

  it('revokes a verification that completes after provider unmount', async () => {
    const verification = deferred<AuthenticationIdentity | null>();
    const adapter = backend();
    vi.mocked(adapter.verify).mockReturnValue(verification.promise);
    const view = setup(adapter);
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    let signing!: Promise<unknown>;
    act(() => { signing = view.result.current.signIn().catch(reason => reason); });
    await waitFor(() => expect(adapter.verify).toHaveBeenCalled());
    view.unmount();
    verification.resolve(identity);
    await signing;
    expect(adapter.signOut).toHaveBeenCalledTimes(1);
  });

  it('clears authentication on network changes and rejects mismatched backend sessions', async () => {
    const adapter = backend();
    vi.mocked(adapter.getSession).mockResolvedValue(identity);
    const view = setup(adapter);
    await waitFor(() => expect(view.result.current.status).toBe('authenticated'));
    state.account = { ...state.account, networkId: 'canton:da-mainnet' };
    view.rerender();
    expect(view.result.current.identity).toBeNull();
    await waitFor(() => expect(adapter.signOut).toHaveBeenCalled());
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
  });

  it('supports sign-out without disconnect and rejects a server identity different from the signed identity', async () => {
    const view = setup();
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
    await act(async () => view.result.current.signIn());
    await act(async () => view.result.current.signOut());
    expect(state.session?.partyId).toBe(identity.partyId);
    expect(view.result.current.identity).toBeNull();
    vi.mocked(view.adapter.verify).mockResolvedValue({ ...identity, partyId: 'bob::party' });
    await act(async () => { await expect(view.result.current.signIn()).rejects.toThrow(/server/); });
    expect(view.result.current.status).toBe('unauthenticated');
  });

  it('waits for wallet restoration before checking or revoking the backend session', async () => {
    state.isLoading = true;
    const view = setup();
    await act(async () => { await Promise.resolve(); });
    expect(view.adapter.getSession).not.toHaveBeenCalled();
    expect(view.adapter.signOut).not.toHaveBeenCalled();
    expect(view.result.current.status).toBe('loading');
    state.isLoading = false;
    view.rerender();
    await waitFor(() => expect(view.result.current.status).toBe('unauthenticated'));
  });

  it('provides translated ready-made sign-in and sign-out actions while retaining the connected account', async () => {
    const adapter = backend();
    render(<PartyLayerLocaleProvider locale="tr">
      <PartyLayerAuthenticationProvider adapter={adapter}><ConnectButton accountStatus="avatar" /></PartyLayerAuthenticationProvider>
    </PartyLayerLocaleProvider>);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Giriş yap' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Giriş yap' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Hesap alice::party' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Uygulamadan çıkış yap' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Giriş yap' })).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Hesap alice::party' })).not.toBeNull();
    expect(adapter.signOut).toHaveBeenCalledTimes(1);
  });
});
