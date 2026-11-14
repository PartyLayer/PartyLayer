import type { CIP0103RequestPayload } from '@partylayer/core';
import { JSON_RPC_ERRORS, ProviderRpcError } from './errors';

/** Validate the shared CIP-0103 request envelope before dispatch or transport. */
export function validateRequestPayload(payload: unknown): asserts payload is CIP0103RequestPayload {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload) ||
      !('method' in payload) || typeof payload.method !== 'string') {
    throw new ProviderRpcError('Request must be an object with a string method', JSON_RPC_ERRORS.INVALID_REQUEST);
  }
  const params = 'params' in payload ? payload.params : undefined;
  if (params !== undefined && (params === null || typeof params !== 'object')) {
    throw new ProviderRpcError('Request params must be an object or array', JSON_RPC_ERRORS.INVALID_PARAMS);
  }
}
