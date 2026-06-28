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
  usePartyState,
  type UseSessionReturn,
  type UseAccountReturn,
  type UseAccountEffectParameters,
  type UsePartyStateReturn,
  type SessionChain,
} from './composables';

// TanStack vue-query foundation: the hierarchical key factory (mirrors React's),
// reused by the upcoming cost/DAML composables so the cache model matches React.
// The consumer supplies the QueryClient via VueQueryPlugin (the Vue analog of
// React's QueryClientProvider); vue-query is a peer dependency.
export { partyLayerKeys, type PartyLayerKeys } from './query-keys';

// CIP-0104 cost composables (Model 2, vue-query): the Vue mirror of React's cost
// hooks. The dApp supplies the fetcher; aliases are ComputedRefs; reactive input.
export {
  useTransactionCostEstimate,
  usePaidTrafficCost,
  type UseTransactionCostEstimateParameters,
  type UseTransactionCostEstimateReturnType,
  type UsePaidTrafficCostParameters,
  type UsePaidTrafficCostReturnType,
} from './use-transaction-cost';

// DAML read composable (Model 2, vue-query): the Vue mirror of React's
// useDamlContract. Generic over T, schema-agnostic, opaque reactive key; the
// contract alias is a ComputedRef. The read counterpart to useChoice (coming next).
export {
  useDamlContract,
  type UseDamlContractParameters,
  type UseDamlContractReturnType,
} from './use-daml-contract';

// DAML write composable (Model 2, vue-query useMutation): the Vue mirror of React's
// useChoice. Generic over R/V, schema-agnostic; exerciseChoice/exerciseChoiceAsync
// alias mutate/mutateAsync. The write counterpart to useDamlContract.
export {
  useChoice,
  type UseChoiceParameters,
  type UseChoiceReturnType,
} from './use-choice';

// CIP-0104 cost UI: the Vue mirror of React's CostPreview. A presentational
// defineComponent (no .vue SFC) that renders cost data passed as props; the dApp
// supplies the data from the cost composables. Theme-independent, styleable via
// class/style fallthrough.
export { CostPreview, type CostPreviewProps } from './cost-preview';
