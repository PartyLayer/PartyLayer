# @partylayer/testing

## 1.1.6

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @partylayer/core@0.11.0
  - @partylayer/provider@0.4.0
  - @partylayer/session@1.1.4

## 1.1.5

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0
  - @partylayer/provider@0.3.2
  - @partylayer/session@1.1.2

## 1.1.4

### Patch Changes

- Updated dependencies [a3f2ea4]
  - @partylayer/provider@0.3.0

## 1.1.3

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0
  - @partylayer/provider@0.2.6
  - @partylayer/session@1.1.1

## 1.1.2

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0
  - @partylayer/provider@0.2.5
  - @partylayer/session@1.0.4

## 1.1.1

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0
  - @partylayer/provider@0.2.4
  - @partylayer/session@1.0.3

## 1.1.0

### Minor Changes

- adaff8e: Add `sessionDataDbName(origin)` — the origin-bound IndexedDB name for the encrypted session DATA (ciphertext envelope) store, counterpart to `sessionKeyDbName`. Lets an E2E assert BOTH encrypted stores (the AES key and the encrypted snapshot) materialized after a connect.

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0
  - @partylayer/provider@0.2.3
  - @partylayer/session@1.0.2

## 1.0.0

### Major Changes

- dd805a0: 1.0 — offline test foundation, published.

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

## 0.1.2

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
- Updated dependencies [9642aee]
  - @partylayer/core@0.5.0
  - @partylayer/provider@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [42c862d]
- Updated dependencies [c18a275]
- Updated dependencies [53b1714]
  - @partylayer/provider@0.2.0
  - @partylayer/core@0.4.0
