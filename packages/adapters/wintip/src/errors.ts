/**
 * Wintip-specific error helpers.
 *
 * Mirrors the approach in @partylayer/adapter-send's errors.ts: we do not
 * introduce new ErrorCode values, we translate Wintip's RPC error `.code`
 * into the closest existing PartyLayer error class. Wintip's bridge
 * (rpcServer.ts) uses the standard CIP-0103 / EIP-1474-derived codes
 * verbatim — no wallet-specific quirks to special-case, unlike Send's
 * auth-timeout detection.
 */

import {
  CapabilityNotSupportedError,
  PartyLayerError,
  TransportError,
  UserRejectedError,
  WalletNotInstalledError,
  mapUnknownErrorToPartyLayerError,
  type ErrorMappingContext,
} from '@partylayer/core';

import { WINTIP_INSTALL_URL, WINTIP_PROVIDER_SCRIPT_URL, WINTIP_WALLET_ID } from './constants';

/** Standard JSON-RPC 2.0 + EIP-1474/CIP-0103 error codes Wintip's bridge surfaces. */
export const WintipRpcErrorCode = {
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  TRANSACTION_REJECTED: -32003,
} as const;

/**
 * The Wintip provider script (wintip-provider.js) is not present on the
 * page — either the dApp never loaded it, or it hasn't finished loading yet.
 */
export class WintipNotInstalledError extends WalletNotInstalledError {
  constructor(reason?: string) {
    super(
      WINTIP_WALLET_ID,
      reason ??
        `Wintip Wallet connector not detected. Include <script src="${WINTIP_PROVIDER_SCRIPT_URL}">, ` +
          `or visit ${WINTIP_INSTALL_URL} to create an account.`,
    );
    this.name = 'WintipNotInstalledError';
    (this as { details?: Record<string, unknown> }).details = {
      ...((this as { details?: Record<string, unknown> }).details ?? {}),
      installUrl: WINTIP_INSTALL_URL,
      scriptUrl: WINTIP_PROVIDER_SCRIPT_URL,
    };
  }
}

interface WintipRpcErrorLike {
  code: number;
  message: string;
  data?: unknown;
}

export function isWintipRpcError(err: unknown): err is WintipRpcErrorLike {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: unknown; message?: unknown };
  return typeof candidate.code === 'number' && typeof candidate.message === 'string';
}

/**
 * Translate a Wintip RPC error to the closest PartyLayer error class.
 * Falls back to mapUnknownErrorToPartyLayerError (keyword-based) when the
 * error doesn't carry a recognizable `.code` — e.g. a plain Error thrown
 * before the RPC round-trip even happened (window.canton missing, etc.).
 */
export function mapWintipError(err: unknown, context: ErrorMappingContext): PartyLayerError {
  if (err instanceof PartyLayerError) return err;

  if (isWintipRpcError(err)) {
    const { code, message } = err;

    if (code === WintipRpcErrorCode.USER_REJECTED) {
      return new UserRejectedError(context.phase, {
        walletId: context.walletId,
        transport: context.transport,
        rpcCode: code,
        originalMessage: message,
      });
    }

    if (
      code === WintipRpcErrorCode.UNSUPPORTED_METHOD ||
      code === WintipRpcErrorCode.METHOD_NOT_FOUND
    ) {
      return new CapabilityNotSupportedError(WINTIP_WALLET_ID, context.phase);
    }

    return new TransportError(message, err, {
      walletId: context.walletId,
      phase: context.phase,
      transport: context.transport,
      rpcCode: code,
    });
  }

  return mapUnknownErrorToPartyLayerError(err, context);
}
