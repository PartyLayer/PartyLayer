/**
 * @partylayer/vue: Vue 3 composables for PartyLayer sessions.
 *
 * Thin reactive bindings over the framework-agnostic `@partylayer/session`
 * store. Mirrors `@partylayer/react`'s API; the React Provider/Kit maps to
 * `provideSessionStore` / the `createPartyLayerSession` plugin here, and hook
 * return values are Vue refs rather than plain values (see README parity table).
 */
export {
  provideSessionStore,
  createPartyLayerSession,
  injectSessionStore,
  SESSION_STORE_KEY,
  type ProvideSessionConfig,
} from './provide';

export {
  useSession,
  useAccount,
  useAccountEffect,
  type UseSessionReturn,
  type UseAccountReturn,
  type UseAccountEffectParameters,
  type SessionChain,
} from './composables';

// TanStack vue-query foundation: the hierarchical key factory (mirrors React's),
// reused by the upcoming cost/DAML composables so the cache model matches React.
// The consumer supplies the QueryClient via VueQueryPlugin (the Vue analog of
// React's QueryClientProvider); vue-query is a peer dependency.
export { partyLayerKeys, type PartyLayerKeys } from './query-keys';
