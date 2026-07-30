import { describe, it, expect } from 'vitest';
import {
  PartyLayerError,
  UserRejectedError,
  TimeoutError,
  InsufficientTrafficError,
  SynchronizerError,
  type ErrorCode,
} from '@partylayer/core';
import { toProviderRpcError, toPartyLayerError } from '../error-map';
import { ProviderRpcError, RPC_ERRORS, JSON_RPC_ERRORS } from '../errors';

describe('toProviderRpcError', () => {
  it('should pass through ProviderRpcError', () => {
    const original = new ProviderRpcError('test', 4001);
    const result = toProviderRpcError(original);
    expect(result).toBe(original);
  });

  it('should map UserRejectedError to 4001', () => {
    const err = new UserRejectedError('connect');
    const result = toProviderRpcError(err);
    expect(result.code).toBe(RPC_ERRORS.USER_REJECTED);
    expect(result).toBeInstanceOf(ProviderRpcError);
  });

  it('should map TimeoutError to -32000', () => {
    const err = new TimeoutError('connect', 30000);
    const result = toProviderRpcError(err);
    expect(result.code).toBe(JSON_RPC_ERRORS.INVALID_INPUT);
  });

  it('should map standard Error to -32603', () => {
    const err = new Error('something broke');
    const result = toProviderRpcError(err);
    expect(result.code).toBe(JSON_RPC_ERRORS.INTERNAL_ERROR);
    expect(result.message).toBe('something broke');
  });

  it('should map RPC-shaped objects', () => {
    const err = { message: 'denied', code: 4001, data: { reason: 'user' } };
    const result = toProviderRpcError(err);
    expect(result.code).toBe(4001);
    expect(result.data).toEqual({ reason: 'user' });
  });

  it('should map string errors', () => {
    const result = toProviderRpcError('unknown failure');
    expect(result.code).toBe(JSON_RPC_ERRORS.INTERNAL_ERROR);
    expect(result.message).toBe('unknown failure');
  });
});

describe('toPartyLayerError', () => {
  it('should map 4001 to USER_REJECTED', () => {
    const rpc = new ProviderRpcError('rejected', 4001);
    const result = toPartyLayerError(rpc);
    expect(result).toBeInstanceOf(PartyLayerError);
    expect(result.code).toBe('USER_REJECTED');
  });

  it('should map unknown codes to INTERNAL_ERROR', () => {
    const rpc = new ProviderRpcError('unknown', 9999);
    const result = toPartyLayerError(rpc);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

describe('INSUFFICIENT_TRAFFIC mapping', () => {
  it('maps InsufficientTrafficError to -32005 (RATE_LIMIT_EXCEEDED)', () => {
    const err = new InsufficientTrafficError('traffic exhausted');
    const result = toProviderRpcError(err);
    expect(result.code).toBe(JSON_RPC_ERRORS.RATE_LIMIT_EXCEEDED);
    expect(result.code).toBe(-32005);
    expect(result).toBeInstanceOf(ProviderRpcError);
  });

  it('maps -32005 back to INSUFFICIENT_TRAFFIC', () => {
    const rpc = new ProviderRpcError('limit exceeded', JSON_RPC_ERRORS.RATE_LIMIT_EXCEEDED);
    const result = toPartyLayerError(rpc);
    expect(result.code).toBe('INSUFFICIENT_TRAFFIC');
  });
});

describe('regression: every previously mapped code is unchanged', () => {
  // The exact forward map as it stood before INSUFFICIENT_TRAFFIC was added, asserted
  // so a future edit cannot silently repoint one of them.
  const FORWARD: Record<Exclude<ErrorCode, 'INSUFFICIENT_TRAFFIC' | 'SYNCHRONIZER_ERROR'>, number> = {
    USER_REJECTED: RPC_ERRORS.USER_REJECTED,
    WALLET_NOT_FOUND: JSON_RPC_ERRORS.RESOURCE_NOT_FOUND,
    ADAPTER_NOT_REGISTERED: JSON_RPC_ERRORS.INVALID_PARAMS,
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

  it('forward maps every legacy code exactly as before', () => {
    for (const [code, expected] of Object.entries(FORWARD)) {
      const result = toProviderRpcError(new PartyLayerError('x', code as ErrorCode));
      expect(result.code, `forward ${code}`).toBe(expected);
    }
  });

  // The reverse map as it stood before, asserted unchanged.
  const REVERSE: Array<[number, ErrorCode]> = [
    [RPC_ERRORS.USER_REJECTED, 'USER_REJECTED'],
    [RPC_ERRORS.UNAUTHORIZED, 'ORIGIN_NOT_ALLOWED'],
    [RPC_ERRORS.UNSUPPORTED_METHOD, 'CAPABILITY_NOT_SUPPORTED'],
    [RPC_ERRORS.DISCONNECTED, 'SESSION_EXPIRED'],
    [RPC_ERRORS.CHAIN_DISCONNECTED, 'TRANSPORT_ERROR'],
    [JSON_RPC_ERRORS.INTERNAL_ERROR, 'INTERNAL_ERROR'],
    [JSON_RPC_ERRORS.METHOD_NOT_FOUND, 'CAPABILITY_NOT_SUPPORTED'],
    [JSON_RPC_ERRORS.RESOURCE_NOT_FOUND, 'WALLET_NOT_FOUND'],
    [JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE, 'WALLET_NOT_INSTALLED'],
    [JSON_RPC_ERRORS.TRANSACTION_REJECTED, 'USER_REJECTED'],
    [JSON_RPC_ERRORS.INVALID_INPUT, 'TIMEOUT'],
  ];

  it('reverse maps every legacy code exactly as before', () => {
    for (const [rpcCode, expected] of REVERSE) {
      const result = toPartyLayerError(new ProviderRpcError('x', rpcCode));
      expect(result.code, `reverse ${rpcCode}`).toBe(expected);
    }
  });
});

describe('SYNCHRONIZER_ERROR mapping (kit-level, no wire code)', () => {
  it('is a PartyLayerError carrying the SYNCHRONIZER_ERROR code', () => {
    const err = new SynchronizerError('disclosed contracts span synchronizers');
    expect(err).toBeInstanceOf(PartyLayerError);
    expect(err.code).toBe('SYNCHRONIZER_ERROR');
  });

  it('forward maps to the generic INTERNAL_ERROR since CIP-0103 has no synchronizer code', () => {
    const err = new SynchronizerError('synchronizer unavailable');
    const result = toProviderRpcError(err);
    expect(result).toBeInstanceOf(ProviderRpcError);
    expect(result.code).toBe(JSON_RPC_ERRORS.INTERNAL_ERROR);
  });

  it('has no dedicated reverse wire code, the generic internal code still resolves to INTERNAL_ERROR', () => {
    const rpc = new ProviderRpcError('internal', JSON_RPC_ERRORS.INTERNAL_ERROR);
    expect(toPartyLayerError(rpc).code).toBe('INTERNAL_ERROR');
  });
});
