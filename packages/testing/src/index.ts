/**
 * @partylayer/testing — pass 1
 *
 * Offline test foundation for PartyLayer:
 *   - createMockWallet      — a CIP-0103-compliant mock provider with
 *                             per-method failure scenarios.
 *   - createTransactionLifecycle — a controllable tx lifecycle (manual +
 *                             auto modes) emitting CIP-0103 `txChanged`.
 *   - offline helpers       — deterministic, fake-timer-friendly utilities.
 *
 * This package is intentionally `private` for now: its API is still forming
 * and we publish v1.0 at the 1.0 milestone once pass 2 (session-lifecycle
 * simulation + TanStack Query test utilities) lands. Keeping it private also
 * keeps it out of the published-API snapshot gate while the surface settles.
 *
 * pass 2 (LATER, after @partylayer/session exists) will add session-lifecycle
 * simulation and TanStack Query test utilities on top of these primitives.
 */

// ── A. Mock CIP-0103 wallet provider ────────────────────────────────────────
export {
  createMockWallet,
  createMockWalletClient,
  type MockWalletConfig,
  type MockMethod,
  type MockWalletClient,
} from './mock-wallet';

// ── Failure scenarios (existing error-model codes only) ──────────────────────
export {
  scenarioToError,
  MOCK_SCENARIO_NAMES,
  type MockScenario,
  type MockScenarioName,
} from './scenarios';

// ── B. Simulated transaction lifecycle ───────────────────────────────────────
export {
  createTransactionLifecycle,
  type TransactionLifecycle,
  type LifecycleConfig,
  type LifecyclePhase,
  type LifecycleDelays,
} from './lifecycle';

// ── C. Offline test utilities ────────────────────────────────────────────────
export { recordTxEvents, connectMock, type TxEventRecorder } from './offline';
