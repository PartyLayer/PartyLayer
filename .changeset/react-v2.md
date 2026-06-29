---
"@partylayer/react": major
---

v2.0: TanStack Query v5 integration and the data-hook modernization.

@partylayer/react v2 replaces the context-based state model with TanStack Query v5 as a
peer dependency. Consumers install @tanstack/react-query (>=5) and wrap their app in
QueryClientProvider (in addition to PartyLayerProvider); PartyLayer does not create the
QueryClient, mirroring the wagmi model.

Breaking changes:
- TanStack Query v5 is now a peer dependency and the data hooks are query/mutation
  hooks. Adding QueryClientProvider is a required setup change.
- useSession's return type changed: it is now the reactive session hook. The previous
  SDK-layer session getter is preserved as useClientSession(). Migrate useSession() to
  useClientSession() where you used the old getter.

Backward-compatible aliases (CantonConnectProvider, useCantonConnect) are preserved for
one minor cycle; the canonical names are PartyLayerProvider and usePartyLayer.

What v2 adds:
- A /query entrypoint (@partylayer/react/query) for the TanStack query and mutation
  hooks and the useSuspenseQuery variants (useSuspenseWallets,
  useSuspenseTransactionCostEstimate, useSuspensePaidTrafficCost).
- Server Components compatibility: the package is marked as a client boundary so it
  imports cleanly into Next.js Server Components, with both entrypoints sharing one
  provider context chunk.
- Cookie-backed session storage for SSR hydration (createCookieStorage), alongside the
  existing createLocalStorage.
- Optimistic updates with automatic rollback for the mutation hooks
  (optimisticMutationOptions), documented in docs/react-optimistic-updates.md.
- New capability hooks: usePartyState (reactive party state), useDamlContract (Model 2
  contract read), and useChoice (Model 2 choice exercise), plus the CIP-0104 cost hooks
  useTransactionCostEstimate and usePaidTrafficCost and the CostPreview component.
- CIP-0103 conformance validated against the shared conformance runner.

Upgrade path: see the v1.x to v2.0 migration guide at docs/react-v2-migration.md, which
maps the changes (including useSession to useClientSession) and the capability hook
names, and marks each step as a mechanical rename or a setup change.
