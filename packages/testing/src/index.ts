/**
 * @partylayer/testing — offline test foundation for PartyLayer.
 *
 * Everything here runs with NO DevNet / live wallet / network: a conformant mock
 * CIP-0103 provider with configurable failure scenarios, a controllable
 * transaction lifecycle, a session-lifecycle harness over the real
 * `@partylayer/session` store, and offline composition helpers. TanStack Query
 * utilities live in the `@partylayer/testing/query` subpath so the main entry
 * stays dependency-free for non-Query consumers; browser/e2e primitives are
 * framework-agnostic script strings for a Playwright smoke.
 */

// ── Mock CIP-0103 wallet provider ────────────────────────────────────────────
export {
  createMockWallet,
  createMockWalletClient,
  type MockWalletConfig,
  type MockMethod,
  type MockWalletClient,
} from './mock-wallet';

// ── Failure scenarios ────────────────────────────────────────────────────────
export {
  scenarioToError,
  MOCK_SCENARIO_NAMES,
  type MockScenario,
  type MockScenarioName,
} from './scenarios';

// ── Simulated transaction lifecycle ──────────────────────────────────────────
export {
  createTransactionLifecycle,
  type TransactionLifecycle,
  type LifecycleConfig,
  type LifecyclePhase,
  type LifecycleDelays,
} from './lifecycle';

// ── Session-lifecycle harness (expiry / party-switch / reconnect / multi-tab) ─
export {
  createSessionHarness,
  createChannelHub,
  type SessionHarness,
  type SessionHarnessConfig,
  type ChannelHub,
} from './session-harness';

// ── Offline utilities + harness ──────────────────────────────────────────────
export {
  recordTxEvents,
  connectMock,
  createOfflineHarness,
  type TxEventRecorder,
  type OfflineHarness,
} from './offline';

// ── Browser / e2e primitives (framework-agnostic script strings) ─────────────
export {
  mockWalletInjectionScript,
  idbEntryCountScript,
  sessionKeyDbName,
  type MockWalletInjectionOptions,
} from './browser';
