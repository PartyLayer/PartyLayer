/**
 * Failure scenarios for the mock CIP-0103 wallet.
 *
 * IMPORTANT: every scenario maps to an EXISTING code in the repo's error
 * model (`@partylayer/provider` ProviderRpcError + RPC_ERRORS / JSON_RPC_ERRORS).
 * No new error codes are invented here. The named presets below are a
 * convenience layer over the existing convenience constructors; you can also
 * pass a raw `ProviderRpcError` or a `{ code, message }` pair to model any
 * other failure the provider error model already supports.
 *
 * Scenario → code mapping (all pre-existing codes):
 *   userRejected        → 4001   (RPC_ERRORS.USER_REJECTED)        via userRejected()
 *   insufficientTraffic → -32002 (JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE) via resourceUnavailable()
 *   synchronizerError   → 4901   (RPC_ERRORS.CHAIN_DISCONNECTED)   via chainDisconnected()
 *   transactionTimeout  → -32003 (JSON_RPC_ERRORS.TRANSACTION_REJECTED) via transactionRejected()
 *   genericError        → -32603 (JSON_RPC_ERRORS.INTERNAL_ERROR)  via internalError()
 */

import {
  ProviderRpcError,
  chainDisconnected,
  internalError,
  resourceUnavailable,
  transactionRejected,
  userRejected,
} from '@partylayer/provider';

/** Built-in named failure scenarios. */
export type MockScenarioName =
  | 'userRejected'
  | 'insufficientTraffic'
  | 'synchronizerError'
  | 'transactionTimeout'
  | 'genericError';

/**
 * A scenario is either a built-in name, a fully-formed `ProviderRpcError`, or
 * a `{ code, message }` pair (which must use an existing numeric code).
 */
export type MockScenario =
  | MockScenarioName
  | ProviderRpcError
  | { code: number; message: string };

const PRESETS: Record<MockScenarioName, () => ProviderRpcError> = {
  userRejected: () => userRejected('User rejected the request'),
  insufficientTraffic: () =>
    resourceUnavailable('Insufficient traffic credits to submit the transaction'),
  synchronizerError: () => chainDisconnected('Synchronizer error'),
  transactionTimeout: () => transactionRejected('Transaction timed out'),
  genericError: () => internalError('RPC handler error'),
};

/** All built-in scenario names (useful for table-driven tests). */
export const MOCK_SCENARIO_NAMES = Object.keys(PRESETS) as MockScenarioName[];

/** Resolve a `MockScenario` into the `ProviderRpcError` the mock will throw. */
export function scenarioToError(scenario: MockScenario): ProviderRpcError {
  if (scenario instanceof ProviderRpcError) return scenario;
  if (typeof scenario === 'string') return PRESETS[scenario]();
  return new ProviderRpcError(scenario.message, scenario.code);
}
