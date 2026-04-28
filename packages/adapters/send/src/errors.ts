/**
 * Send-specific error helpers.
 *
 * PartyLayer's `ErrorCode` union (in `@partylayer/core/errors.ts`) is the
 * canonical taxonomy. We do NOT introduce new codes here — instead, the
 * Send-specific error classes subclass the closest existing PartyLayer
 * error and carry the diagnostic detail (kernel id, RPC code) in
 * `details`. That way existing telemetry pipelines and `code`-based
 * branches in dApp code continue to work without modification.
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

import { SEND_INSTALL_URL, SEND_KERNEL_ID } from './constants';

/** JSON-RPC 2.0 + EIP-1193 error codes Sigilry surfaces. */
export const SendRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  INVALID_INPUT: -32000,
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_UNAVAILABLE: -32002,
  TRANSACTION_REJECTED: -32003,
  METHOD_NOT_SUPPORTED: -32004,
  LIMIT_EXCEEDED: -32005,
} as const;

const WALLET_ID = 'send';

/**
 * Send isn't installed — `window.canton` is unavailable entirely.
 *
 * Subclasses `WalletNotInstalledError` so existing capability gates and
 * UI ("install Send") light up automatically. Carries the install URL in
 * `details` for one-click prompts.
 */
export class SendNotInstalledError extends WalletNotInstalledError {
  constructor(reason?: string) {
    super(
      WALLET_ID,
      reason ?? `Send Canton Wallet is not detected. Install from ${SEND_INSTALL_URL}`,
    );
    this.name = 'SendNotInstalledError';
    (this as { details?: Record<string, unknown> }).details = {
      ...((this as { details?: Record<string, unknown> }).details ?? {}),
      installUrl: SEND_INSTALL_URL,
    };
  }
}

/**
 * `window.canton` is present but `kernel.id` does not match Send.
 *
 * Treated as "Send not installed" from the SDK's perspective so that
 * other adapters get a chance to claim the active provider — but the
 * runtime kernel id is preserved in `details` for diagnostics.
 *
 * The wording avoids the keywords "rejected"/"denied"/"cancelled" so
 * `mapUnknownErrorToPartyLayerError` won't silently rewrite this as a
 * `UserRejectedError` when re-thrown through error mapping.
 */
export class SendKernelMismatchError extends WalletNotInstalledError {
  constructor(actualKernelId: string) {
    super(
      WALLET_ID,
      `Another Canton wallet is active at window.canton (kernel.id="${actualKernelId}", expected "${SEND_KERNEL_ID}"). The Send adapter will yield to the matching adapter.`,
    );
    this.name = 'SendKernelMismatchError';
    (this as { details?: Record<string, unknown> }).details = {
      ...((this as { details?: Record<string, unknown> }).details ?? {}),
      actualKernelId,
      expectedKernelId: SEND_KERNEL_ID,
    };
  }
}

interface SendRpcErrorLike {
  code: number;
  message: string;
  data?: unknown;
}

function isSendRpcError(err: unknown): err is SendRpcErrorLike {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: unknown; message?: unknown };
  return typeof candidate.code === 'number' && typeof candidate.message === 'string';
}

/**
 * Translate a Sigilry RPC error to the closest PartyLayer error class.
 *
 * Falls back to `mapUnknownErrorToPartyLayerError` when the error doesn't
 * carry a recognisable JSON-RPC `code`. Note that `mapUnknownErrorToPartyLayerError`
 * itself rewrites messages containing "rejected"/"denied"/"cancelled" into
 * `UserRejectedError`, so we explicitly route the 4001 code first to make
 * the user-rejection path stable across wording changes in the wallet.
 */
export function mapSigilryError(
  err: unknown,
  context: ErrorMappingContext,
): PartyLayerError {
  if (err instanceof PartyLayerError) return err;

  if (isSendRpcError(err)) {
    const code = err.code;
    const message = err.message;

    if (code === SendRpcErrorCode.USER_REJECTED) {
      return new UserRejectedError(context.phase, {
        walletId: context.walletId,
        transport: context.transport,
        rpcCode: code,
        originalMessage: message,
      });
    }

    if (
      code === SendRpcErrorCode.UNSUPPORTED_METHOD ||
      code === SendRpcErrorCode.METHOD_NOT_FOUND ||
      code === SendRpcErrorCode.METHOD_NOT_SUPPORTED
    ) {
      return new CapabilityNotSupportedError(WALLET_ID, context.phase);
    }

    if (
      code === SendRpcErrorCode.DISCONNECTED ||
      code === SendRpcErrorCode.CHAIN_DISCONNECTED ||
      code === SendRpcErrorCode.UNAUTHORIZED
    ) {
      return new TransportError(message, err, {
        walletId: context.walletId,
        phase: context.phase,
        transport: context.transport,
        rpcCode: code,
      });
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

/**
 * Build a hint string when the developer passes a short-form Canton
 * template ID OR the legacy pre-Token-Standard `Amulet_Transfer` choice.
 *
 * Mirrors `loop-adapter.templateIdHint` so Send produces the same
 * actionable error text for the same payload bug class. Returns an empty
 * string when no problem is detected — callers can append this to a base
 * error message unconditionally.
 */
export function templateIdHint(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const commands = (payload as { commands?: unknown }).commands;
  if (!Array.isArray(commands)) return '';

  try {
    for (const cmd of commands as Array<Record<string, unknown>>) {
      const exercise = (cmd?.ExerciseCommand ?? cmd?.exerciseCommand ?? cmd?.exercise) as
        | Record<string, unknown>
        | undefined;
      const create = (cmd?.CreateCommand ?? cmd?.createCommand ?? cmd?.create) as
        | Record<string, unknown>
        | undefined;
      const raw = (exercise?.templateId ?? create?.templateId) as string | undefined;
      const choice = exercise?.choice as string | undefined;

      if (
        choice === 'Amulet_Transfer' &&
        typeof raw === 'string' &&
        raw.includes('Splice.Amulet:Amulet')
      ) {
        return (
          " The command exercises 'Amulet_Transfer' directly on the Amulet template — that's the " +
          'legacy (pre-CIP-56) path Canton no longer accepts. Use the Token Standard flow: exercise ' +
          "'TransferFactory_Transfer' by interface on a TransferFactory contract " +
          "(interfaceId '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory'). " +
          'See https://partylayer.xyz/docs/token-transfers for the canonical flow.'
        );
      }

      if (typeof raw === 'string' && raw.length > 0 && !raw.startsWith('#')) {
        return (
          ` The command uses templateId="${raw}" which is the short Canton form; Send requires ` +
          "the fully-qualified Daml form (e.g. '#splice-amulet:Splice.Amulet:Amulet')."
        );
      }
    }
  } catch {
    // best-effort; never throw from a hint helper
  }
  return '';
}

/**
 * Bound preview of an arbitrary value for inclusion in error messages.
 * Keeps logs small when a payload is large or contains binary blobs.
 */
export function safePreview(value: unknown, maxLen = 200): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  try {
    const s = JSON.stringify(value);
    if (typeof s !== 'string') return String(value);
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
  } catch {
    return String(value);
  }
}
