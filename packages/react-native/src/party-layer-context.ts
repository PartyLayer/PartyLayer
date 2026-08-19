/**
 * The PartyLayer context object and the hooks that read it.
 *
 * Deliberately separate from the provider. The provider imports `createSessionStore` from
 * @partylayer/session, and a component that only needs to resolve a client (every hook and
 * every UI component) must not drag that in. Importing ConnectButton pulled the session
 * store into the ui bundle when these lived together, which the size gate caught.
 */
import { createContext, useContext } from 'react';
import type { PartyLayerClient, Session, WalletInfo } from '@partylayer/sdk';
import type { SessionStore } from '@partylayer/session';

export interface PartyLayerContextValue {
  client: PartyLayerClient | null;
  /** The sdk-level session, kept current by the client's session events. */
  session: Session | null;
  wallets: WalletInfo[];
  isLoading: boolean;
  error: Error | null;
  /** Shared session store, read by `useAccount`, `useSession` and `useAccountEffect`. */
  store: SessionStore | null;
}

export const PartyLayerContext = createContext<PartyLayerContextValue | null>(null);

const NO_PROVIDER =
  'No PartyLayerProvider found. Wrap your app in <PartyLayerProvider client={client}>, ' +
  'or pass the client to the hook directly, for example useConnect(client).';

/**
 * Read the context. Throws when no provider is above, naming the provider so the fix is
 * obvious. Hooks called with an explicit client never reach this.
 */
export function usePartyLayerContext(): PartyLayerContextValue {
  const context = useContext(PartyLayerContext);
  if (!context) throw new Error(NO_PROVIDER);
  return context;
}

/** The client from `PartyLayerProvider`. Throws when there is no provider, or no client. */
export function usePartyLayer(): PartyLayerClient {
  const { client } = usePartyLayerContext();
  if (!client) throw new Error('PartyLayer client not initialized');
  return client;
}

/**
 * Whether a value is a PartyLayer client rather than a hook parameters object.
 *
 * Deliberately duck typed rather than `instanceof PartyLayerClient`. Two reasons: test
 * doubles and stubs are plain objects that would fail an instance check, and a tree with
 * two copies of the sdk installed would fail it too. The parameter objects this has to be
 * told apart from (`UseWalletsParameters`) carry no methods, so a value exposing `connect`
 * or `listWallets` is unambiguously a client.
 */
export function isPartyLayerClient(value: unknown): value is PartyLayerClient {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { connect?: unknown; listWallets?: unknown };
  return typeof candidate.connect === 'function' || typeof candidate.listWallets === 'function';
}

/**
 * Resolve the client a hook should use: the explicit argument when given, else the one from
 * context. Kept in one place so every hook behaves identically.
 */
export function useResolvedClient(explicit?: PartyLayerClient): PartyLayerClient {
  const context = useContext(PartyLayerContext);
  if (explicit) return explicit;
  if (!context?.client) throw new Error(NO_PROVIDER);
  return context.client;
}
