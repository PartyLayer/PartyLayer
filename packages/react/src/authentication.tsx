'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  formatAuthenticationMessage, validateAuthenticationChallenge,
  type AuthenticationChallenge, type AuthenticationIdentity,
} from '@partylayer/core/authentication';
import { toCAIP2Network } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useAccount } from './session-hooks';

/** An application-backend integration, not a wallet adapter or another npm package. */
export interface PartyLayerAuthenticationAdapter {
  getSession(): Promise<AuthenticationIdentity | null>;
  getChallenge(identity: AuthenticationIdentity): Promise<AuthenticationChallenge>;
  /** The server consumes its own stored challenge and verifies the signature/key authorization. */
  verify(proof: { nonce: string; signature: string }): Promise<AuthenticationIdentity | null>;
  signOut(): Promise<void>;
}

export interface UseAuthenticationReturn {
  status: 'loading' | 'unauthenticated' | 'authenticated';
  identity: AuthenticationIdentity | null;
  isPending: boolean;
  /** A validated server challenge is ready; call signIn directly from the click handler. */
  canSignIn: boolean;
  error: Error | null;
  /** Explicit user action; never automatically prompts for a signature on mount. */
  signIn(): Promise<void>;
  /** Invalidates the server session without disconnecting the wallet. */
  signOut(): Promise<void>;
  /** Recheck backend session validity, e.g. after an API returns 401. */
  refresh(): Promise<void>;
}

const AuthenticationContext = createContext<UseAuthenticationReturn | null>(null);
export const useOptionalAuthentication = () => useContext(AuthenticationContext);

export function useAuthentication(): UseAuthenticationReturn {
  const context = useOptionalAuthentication();
  if (!context) throw new Error('useAuthentication requires PartyLayerAuthenticationProvider or PartyLayerKit.authentication');
  return context;
}

export interface PartyLayerAuthenticationProviderProps {
  adapter: PartyLayerAuthenticationAdapter;
  children: React.ReactNode;
}

const sameIdentity = (left: AuthenticationIdentity | null, right: AuthenticationIdentity | null) =>
  !!left && !!right && left.partyId === right.partyId && left.networkId === right.networkId;

export function PartyLayerAuthenticationProvider({ adapter, children }: PartyLayerAuthenticationProviderProps) {
  const { client, session, isLoading } = usePartyLayerContext();
  const account = useAccount();
  const resolving = isLoading || account.isConnecting || account.isReconnecting ||
    (!!session && (!account.party || !account.networkId));
  const identity = session && !session.networkMismatch && account.isConnected && account.party && account.networkId &&
    account.networkId === toCAIP2Network(session.network).networkId
    ? { partyId: account.party, networkId: account.networkId } : null;
  const key = identity ? JSON.stringify([session?.walletId, identity.partyId, identity.networkId]) : '';
  const current = useRef({ key, identity, adapter, client });
  current.current = { key, identity, adapter, client };
  const [state, setState] = useState<{ key: string; status: UseAuthenticationReturn['status']; identity: AuthenticationIdentity | null }>({
    key: '', status: 'loading', identity: null,
  });
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setPending] = useState(false);
  const [prepared, setPrepared] = useState<{
    key: string; adapter: PartyLayerAuthenticationAdapter; challenge: AuthenticationChallenge;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const operation = useRef(0);
  const backend = useRef<Promise<unknown>>(Promise.resolve());
  // Serialize cookie-changing calls. A late verify cannot re-establish an old
  // identity after its queued logout, or clear a newer successful sign-in.
  const runBackend = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    const result = backend.current.then(action, action);
    backend.current = result.catch(() => {});
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const captured = current.current;
    const id = ++operation.current;
    if (mounted.current) {
      setPrepared(null);
      setError(null);
      setState({ key: captured.key, status: 'loading', identity: null });
    }
    try {
      const restored = await runBackend(() => captured.adapter.getSession());
      if (!mounted.current || current.current.key !== captured.key || current.current.adapter !== captured.adapter ||
        current.current.client !== captured.client || operation.current !== id) return;
      if (restored && !sameIdentity(restored, captured.identity)) {
        await runBackend(() => captured.adapter.signOut());
      }
      if (mounted.current && current.current.key === captured.key && operation.current === id) {
        const valid = sameIdentity(restored, captured.identity);
        setState({ key: captured.key, status: valid ? 'authenticated' : 'unauthenticated', identity: valid ? restored : null });
      }
    } catch (reason) {
      if (mounted.current && current.current.key === captured.key && operation.current === id) {
        setError(reason instanceof Error ? reason : new Error('Authentication session check failed'));
        setState({ key: captured.key, status: 'unauthenticated', identity: null });
      }
    }
  }, [runBackend]);

  const previous = useRef<{ key: string; adapter: PartyLayerAuthenticationAdapter; client: typeof client } | null>(null);
  useEffect(() => {
    mounted.current = true;
    if (resolving) return () => { mounted.current = false; ++operation.current; };
    const old = previous.current;
    previous.current = { key, adapter, client };
    setError(null);
    // Initial page load may restore a matching server session. A subsequent
    // wallet/account/network/config change always invalidates the old session.
    if (old && ((!!old.key && old.key !== key) || old.adapter !== adapter || old.client !== client)) {
      ++operation.current;
      void runBackend(() => old.adapter.signOut()).then(refresh).catch(reason => {
        if (mounted.current) {
          setError(reason instanceof Error ? reason : new Error('Authentication logout failed'));
          setState({ key: current.current.key, status: 'unauthenticated', identity: null });
        }
      });
    } else {
      void refresh();
    }
    return () => { mounted.current = false; ++operation.current; };
  }, [key, adapter, client, resolving, refresh, runBackend]);

  // Fetch the nonce before the click. Awaiting an HTTP request in signIn before
  // invoking a hosted wallet would lose browser user activation and block its popup.
  // Preparing a challenge never requests a wallet signature.
  useEffect(() => {
    setPrepared(null);
    if (resolving || state.key !== key || state.status !== 'unauthenticated' || !identity || pending.current) {
      setPreparing(false);
      return;
    }
    let cancelled = false;
    const captured = current.current;
    const id = operation.current;
    const valid = () => !cancelled && mounted.current && operation.current === id &&
      current.current.key === captured.key && current.current.adapter === captured.adapter && current.current.client === captured.client;
    setPreparing(true);
    void runBackend(() => captured.adapter.getChallenge(captured.identity!)).then(challenge => {
      if (!valid()) return;
      validateAuthenticationChallenge(challenge, { ...captured.identity!, origin: window.location.origin });
      setPrepared({ key: captured.key, adapter: captured.adapter, challenge });
    }).catch(reason => {
      if (valid()) setError(reason instanceof Error ? reason : new Error('Authentication challenge preparation failed'));
    }).finally(() => { if (valid()) setPreparing(false); });
    return () => { cancelled = true; };
  }, [key, adapter, client, resolving, state.key, state.status, challengeVersion, runBackend]);

  const signOut = useCallback(async () => {
    const captured = current.current;
    ++operation.current;
    if (mounted.current) {
      setPrepared(null);
      setState({ key: current.current.key, status: 'unauthenticated', identity: null });
      setError(null);
      setChallengeVersion(version => version + 1);
    }
    try { await runBackend(() => captured.adapter.signOut()); }
    catch (reason) {
      const failure = reason instanceof Error ? reason : new Error('Authentication logout failed');
      if (mounted.current) setError(failure);
      throw failure;
    }
  }, [runBackend]);

  const signIn = useCallback(async () => {
    if (pending.current) throw new Error('An authentication request is already pending');
    const captured = current.current;
    if (!captured.identity || !client) throw new Error('Connect a wallet on the supported network before signing in');
    const id = ++operation.current;
    const assertCurrent = () => {
      if (!mounted.current || current.current.key !== captured.key || current.current.adapter !== captured.adapter ||
        current.current.client !== captured.client || operation.current !== id) {
        throw new Error('Wallet account or network changed during authentication');
      }
    };
    pending.current = true;
    setPending(true);
    setError(null);
    try {
      assertCurrent();
      if (!prepared || prepared.key !== captured.key || prepared.adapter !== captured.adapter) {
        throw new Error('Wait for the authentication challenge before signing in');
      }
      const { challenge } = prepared;
      setPrepared(null);
      validateAuthenticationChallenge(challenge, { ...captured.identity, origin: window.location.origin });
      const message = formatAuthenticationMessage(challenge);
      // Keep this wallet call before the first await in the user action.
      const signed = await client.signMessage({ message });
      assertCurrent();
      if (signed.message !== message || String(signed.partyId) !== captured.identity.partyId) {
        throw new Error('Wallet signed for an unexpected message or party');
      }
      validateAuthenticationChallenge(challenge, { ...captured.identity, origin: window.location.origin });
      const verified = await runBackend(async () => {
        assertCurrent();
        let result: AuthenticationIdentity | null;
        try {
          result = await captured.adapter.verify({ nonce: challenge.nonce, signature: String(signed.signature) });
        } catch (reason) {
          // A transport/response-parsing error does not prove the server failed
          // to create a session. Revoke it before another login can start.
          try { await captured.adapter.signOut(); }
          catch { throw new Error('Authentication verification failed and the server session could not be cleared'); }
          throw reason;
        }
        if (!mounted.current || current.current.key !== captured.key || operation.current !== id) {
          // A verification that already reached the server must be explicitly
          // revoked even if the provider unmounts or the user disconnects.
          await captured.adapter.signOut();
          throw new Error('Wallet account or network changed during authentication');
        }
        return result;
      });
      assertCurrent();
      if (!sameIdentity(verified, captured.identity)) {
        await runBackend(() => captured.adapter.signOut());
        throw new Error('The server did not authenticate the current party and network');
      }
      setState({ key: captured.key, status: 'authenticated', identity: verified });
    } catch (reason) {
      const failure = reason instanceof Error ? reason : new Error('Authentication failed');
      if (mounted.current && current.current.key === captured.key && operation.current === id) {
        setError(failure);
        setState({ key: captured.key, status: 'unauthenticated', identity: null });
      }
      throw failure;
    } finally {
      pending.current = false;
      if (mounted.current) {
        setPending(false);
        setChallengeVersion(version => version + 1);
      }
    }
  }, [client, prepared, runBackend]);

  const active = state.key === key && sameIdentity(state.identity, identity);
  return <AuthenticationContext.Provider value={{
    status: resolving || preparing ? 'loading' : active ? state.status : state.key === key && state.status === 'loading' ? 'loading' : 'unauthenticated',
    identity: active ? state.identity : null, isPending,
    canSignIn: !resolving && !isPending && state.status === 'unauthenticated' &&
      prepared?.key === key && prepared?.adapter === adapter,
    error, signIn, signOut, refresh,
  }}>{children}</AuthenticationContext.Provider>;
}
