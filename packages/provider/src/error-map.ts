/**
 * Bidirectional error mapping between PartyLayer ErrorCode and CIP-0103 numeric codes
 *
 * This module ensures no PartyLayer internals leak through the Provider surface,
 * and provides a reverse path for the bridge.
 */

import { PartyLayerError, type ErrorCode } from '@partylayer/core';
import { ProviderRpcError, RPC_ERRORS, JSON_RPC_ERRORS } from './errors';

// ─── PartyLayer ErrorCode → CIP-0103 numeric code ──────────────────────────

const ERROR_CODE_TO_RPC: Record<ErrorCode, number> = {
  USER_REJECTED: RPC_ERRORS.USER_REJECTED,
  WALLET_NOT_FOUND: JSON_RPC_ERRORS.RESOURCE_NOT_FOUND,
  WALLET_NOT_INSTALLED: JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE,
  ORIGIN_NOT_ALLOWED: RPC_ERRORS.UNAUTHORIZED,
  SESSION_EXPIRED: RPC_ERRORS.DISCONNECTED,
  CAPABILITY_NOT_SUPPORTED: RPC_ERRORS.UNSUPPORTED_METHOD,
  TRANSPORT_ERROR: JSON_RPC_ERRORS.INTERNAL_ERROR,
  REGISTRY_FETCH_FAILED: JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE,
  REGISTRY_VERIFICATION_FAILED: JSON_RPC_ERRORS.INTERNAL_ERROR,
  REGISTRY_SCHEMA_INVALID: JSON_RPC_ERRORS.INTERNAL_ERROR,
  INTERNAL_ERROR: JSON_RPC_ERRORS.INTERNAL_ERROR,
  NETWORK_MISMATCH: JSON_RPC_ERRORS.INVALID_INPUT,
  TIMEOUT: JSON_RPC_ERRORS.INVALID_INPUT,
};

// ─── CIP-0103 numeric code → PartyLayer ErrorCode (best-effort reverse) ────

const RPC_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  [RPC_ERRORS.USER_REJECTED]: 'USER_REJECTED',
  [RPC_ERRORS.UNAUTHORIZED]: 'ORIGIN_NOT_ALLOWED',
  [RPC_ERRORS.UNSUPPORTED_METHOD]: 'CAPABILITY_NOT_SUPPORTED',
  [RPC_ERRORS.DISCONNECTED]: 'SESSION_EXPIRED',
  [RPC_ERRORS.CHAIN_DISCONNECTED]: 'TRANSPORT_ERROR',
  [JSON_RPC_ERRORS.INTERNAL_ERROR]: 'INTERNAL_ERROR',
  [JSON_RPC_ERRORS.METHOD_NOT_FOUND]: 'CAPABILITY_NOT_SUPPORTED',
  [JSON_RPC_ERRORS.RESOURCE_NOT_FOUND]: 'WALLET_NOT_FOUND',
  [JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE]: 'WALLET_NOT_INSTALLED',
  [JSON_RPC_ERRORS.TRANSACTION_REJECTED]: 'USER_REJECTED',
  [JSON_RPC_ERRORS.INVALID_INPUT]: 'TIMEOUT',
};

/**
 * Convert any error into a ProviderRpcError for the CIP-0103 surface.
 *
 * This is the single normalization point — every error that escapes
 * the Provider MUST pass through this function.
 */
export function toProviderRpcError(err: unknown): ProviderRpcError {
  // Already a ProviderRpcError — pass through
  if (err instanceof ProviderRpcError) {
    return err;
  }

  // PartyLayerError — map code
  if (err instanceof PartyLayerError) {
    const code = ERROR_CODE_TO_RPC[err.code] ?? JSON_RPC_ERRORS.INTERNAL_ERROR;
    return new ProviderRpcError(err.message, code, {
      originalCode: err.code,
      details: err.details,
    });
  }

  // RPC-shaped error from a wallet provider (has numeric code)
  if (isRpcShaped(err)) {
    return new ProviderRpcError(err.message, err.code, err.data);
  }

  // Standard Error
  if (err instanceof Error) {
    return new ProviderRpcError(err.message, JSON_RPC_ERRORS.INTERNAL_ERROR);
  }

  // Unknown
  return new ProviderRpcError(String(err), JSON_RPC_ERRORS.INTERNAL_ERROR);
}

/**
 * Convert ProviderRpcError back to a PartyLayerError.
 *
 * Used by the bridge path when errors from the Provider surface
 * need to flow back into the PartyLayerClient world.
 */
export function toPartyLayerError(err: ProviderRpcError): PartyLayerError {
  const code = RPC_TO_ERROR_CODE[err.code] ?? 'INTERNAL_ERROR';
  return new PartyLayerError(err.message, code, {
    details: { rpcCode: err.code, data: err.data },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isRpcShaped(
  err: unknown,
): err is { message: string; code: number; data?: unknown } {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e.message === 'string' && typeof e.code === 'number';
}
