---
"@partylayer/testing": major
---

1.0 — offline test foundation, published.

`@partylayer/testing` becomes a public, stable package providing everything
needed to test PartyLayer integrations with no DevNet or live wallet:

- **Mock CIP-0103 provider** with configurable per-method failure scenarios
  (connect rejection, insufficient traffic, synchronizer error, transaction
  timeout) — conformant by construction.
- **Transaction lifecycle simulation** with controllable phase transitions
  (`isPreparing → isSubmitting → isConfirming → isFinalized`, plus failure).
- **Session-lifecycle harness** (`createSessionHarness`) driving the real
  `@partylayer/session` store: forced expiry (via the store's real timer),
  party-switch, transient-disconnect/reconnect, and multi-tab disconnect
  propagation — never synthetic event shortcuts.
- **Offline composition** (`createOfflineHarness`) wiring a mock wallet to a real
  session store.
- **TanStack Query utilities** at the `@partylayer/testing/query` subpath
  (cache assertions, invalidation, optimistic rollback, query-inclusive harness);
  `@tanstack/query-core` is an optional peer so the main entry stays
  dependency-free.
- **Browser/e2e primitives** (framework-agnostic script strings) for a real-browser
  Playwright persistence smoke.
