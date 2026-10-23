/**
 * Choosing the execute verb on the generic CIP-0103 paths.
 *
 * THE DEFECT THIS FIXES. CIP-0103 has two execute verbs, and the standard's own
 * published types (`@canton-network/core-wallet-dapp-rpc-client@1.4.0`,
 * `dist/index.d.ts:586-587`) say what each returns:
 *
 *     PrepareExecute        = (params) => Promise<Null>
 *     PrepareExecuteAndWait = (params) => Promise<PrepareExecuteAndWaitResult>
 *
 * Both generic adapters called the first and read its result as though it were
 * the second, casting a `Null` to a `TxReceipt`. Against a conformant wallet the
 * caller therefore received a receipt whose every field was `undefined`. That is
 * also why several adapters invented `transactionHash` values: the interface
 * asked for something the path could not produce.
 *
 * WHY THIS IS A NEGOTIATION AND NOT A SUBSTITUTION. `prepareExecuteAndWait` is
 * not universally implemented, and one wallet in the registry proves it.
 * OneSwap's provider dispatches `prepareExecute` and rejects everything else
 * with 4200 (`@oneswap/wallet-cip0103-adapter@0.2.0`, `dist/provider.js:93-103`);
 * it has no `prepareExecuteAndWait` at all. It is also the one wallet whose
 * `prepareExecute` returns something usable rather than null, so a straight
 * substitution would have fixed four wallets and broken the fifth.
 *
 * PartyLayer's own conformance model agrees that the awaited verb is optional:
 * `CIP0103_MANDATORY_METHODS` lists ten methods and does not include it
 * (`@partylayer/core`, `cip0103-types.ts:174-190`).
 *
 * So: prefer the awaited verb, fall back to the plain one when — and only when —
 * the wallet says it does not have it, and remember the answer per provider.
 */

import type {
  CIP0103Provider,
  LoggerAdapter,
  SubmitTransactionParams,
  TxReceipt,
} from '@partylayer/core';
import { toTransactionHash, TransportError } from '@partylayer/core';

/**
 * The two codes that mean "this wallet does not have that method": CIP-0103's
 * `UNSUPPORTED_METHOD` and JSON-RPC's `METHOD_NOT_FOUND`. Mirrors
 * `@partylayer/provider`'s `PROVIDER_ERRORS` (`src/errors.ts:46,61`); duplicated
 * as two literals rather than imported to avoid an SDK→provider value dependency
 * for two numbers.
 *
 * The detection is deliberately code-only. A fallback fires a SECOND submit, so
 * it must run only when the first verb provably never reached the ledger. A user
 * rejection (4001), a timeout, or any uncoded failure re-throws instead — better
 * to surface an error than to put a transaction in front of someone twice.
 */
const UNSUPPORTED_METHOD = 4200;
const METHOD_NOT_FOUND = -32601;

function isUnsupportedMethod(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return code === UNSUPPORTED_METHOD || code === METHOD_NOT_FOUND;
}

/**
 * Which verb this provider turned out to support, plus whether we have already
 * said so. One instance per adapter, so the wallet is asked at most once and the
 * log appears at most once.
 */
export interface ExecuteVerbState {
  /** Resolved after the first submit; absent until then. */
  verb?: 'awaited' | 'plain';
  /** Set once a degradation has been reported, so it is reported only once. */
  logged?: boolean;
}

/**
 * The awaited verb's result, per the standard's `PrepareExecuteAndWaitResult`.
 *
 * Preserve actual completion offsets so provider bridges can emit a complete
 * executed event without manufacturing an offset or using a command as an update id.
 */
interface ExecutedTxResponse {
  tx?: { commandId?: unknown; payload?: { updateId?: unknown; completionOffset?: unknown } };
}

/**
 * Build a receipt from an executed-transaction response, or `null` when the
 * response does not carry a real update id.
 *
 * `transactionHash` is set to the update id, following the Send adapter, which
 * reaches the same response and does the same
 * (`@partylayer/adapter-send`, `src/send-adapter.ts:308`). A real ledger
 * identifier in that field is what the placeholder values were standing in for.
 */
function receiptFromExecutedTx(result: unknown): TxReceipt | null {
  const tx = (result as ExecutedTxResponse | null | undefined)?.tx;
  const updateId = tx?.payload?.updateId;
  if (typeof updateId !== 'string' || updateId.length === 0) return null;
  return {
    transactionHash: toTransactionHash(updateId),
    submittedAt: Date.now(),
    commandId: typeof tx?.commandId === 'string' ? tx.commandId : undefined,
    updateId,
    ...(validOffset(tx?.payload?.completionOffset) ? { completionOffset: tx.payload!.completionOffset as number } : {}),
  };
}

/** Acknowledgement is not confirmation: missing identifiers remain absent. */
function normalizeReceipt(result: unknown, request: Record<string, unknown>): TxReceipt {
  const executed = receiptFromExecutedTx(result);
  if (executed) return executed;
  const value = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const timestamp = typeof value.submittedAt === 'number'
    ? value.submittedAt : typeof value.submittedAt === 'string' ? Date.parse(value.submittedAt) : NaN;
  const tx = value.tx && typeof value.tx === 'object' ? value.tx as Record<string, unknown> : {};
  const commandId = typeof value.commandId === 'string' ? value.commandId
    : typeof tx.commandId === 'string' ? tx.commandId
    : typeof request.commandId === 'string' ? request.commandId : undefined;
  return {
    submittedAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
    ...(typeof value.transactionHash === 'string' && value.transactionHash.length > 0
      ? { transactionHash: toTransactionHash(value.transactionHash) } : {}),
    ...(typeof value.updateId === 'string' && value.updateId.length > 0 ? { updateId: value.updateId } : {}),
    ...(validOffset(value.completionOffset) ? { completionOffset: value.completionOffset as number } : {}),
    ...(commandId ? { commandId } : {}),
  };
}

function validOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function reportOnce(
  state: ExecuteVerbState,
  walletId: string,
  detail: string,
  logger?: LoggerAdapter,
): void {
  if (state.logged) return;
  state.logged = true;
  logger?.warn(
    `[PartyLayer] ${walletId}: ${detail} Confirm ledger completion only when the receipt contains a real updateId.`,
  );
}

/**
 * Submit through the wallet's execute verb, preferring the one that returns a
 * result.
 *
 * Returns a populated receipt when the wallet supports `prepareExecuteAndWait`.
 * Every response is normalized to the public receipt contract. A plain null
 * acknowledgement carries no ledger identifier and must not be treated as a
 * confirmed commit. No accepted submission is retried to obtain a better receipt.
 */
export async function submitViaPrepareExecute(
  provider: CIP0103Provider,
  params: SubmitTransactionParams,
  opts: { walletId: string; state: ExecuteVerbState; logger?: LoggerAdapter },
): Promise<TxReceipt> {
  // PartyLayer owns the outer signedTx envelope; CIP-0103 receives the inner
  // PrepareExecuteParams (commands, commandId, actAs, disclosedContracts, ...).
  // Accept a direct payload from legacy untyped callers as well.
  const payload = Object.prototype.hasOwnProperty.call(params, 'signedTx') ? params.signedTx : params;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TransportError('CIP-0103 submission requires a command payload object as signedTx');
  }
  const rpcParams = payload as Record<string, unknown>;
  const { walletId, state, logger } = opts;

  if (state.verb !== 'plain') {
    try {
      const result = await provider.request<unknown>({
        method: 'prepareExecuteAndWait',
        params: rpcParams,
      });
      state.verb = 'awaited';

      const receipt = receiptFromExecutedTx(result);
      if (receipt) return receipt;

      // The wallet accepted the awaited verb but did not return an update id.
      // Do NOT retry the other verb: the transaction has already been submitted,
      // and a second submit is far worse than a thin receipt.
      reportOnce(
        state,
        walletId,
        'prepareExecuteAndWait returned no updateId.',
        logger,
      );
      return normalizeReceipt(result, rpcParams);
    } catch (err) {
      if (!isUnsupportedMethod(err)) throw err;
      // The wallet rejected the METHOD, so nothing was submitted and falling
      // through to the other verb cannot double-submit.
      state.verb = 'plain';
      reportOnce(
        state,
        walletId,
        'has no prepareExecuteAndWait; using prepareExecute, which the CIP-0103 types return as null.',
        logger,
      );
    }
  }

  // A wallet without the awaited verb still gets one submission, followed by
  // a truthful receipt; an acknowledgement never invents a ledger identifier.
  const result = await provider.request<unknown>({ method: 'prepareExecute', params: rpcParams });
  return normalizeReceipt(result, rpcParams);
}
