'use client';

import { useEffect, useRef, useState } from 'react';
import { toCAIP2Network, type Session, type SubmitTransactionParams } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useTransactionFlow, type UseTransactionFlowParameters } from './use-transaction-flow';

export interface OperationPreparationContext {
  walletId: string;
  partyId: string;
  networkId: string;
  /** Generated before preparation. The command payload must carry this exact id. */
  commandId: string;
  /** Cancels preparation only. Never implies cancellation of a wallet submission. */
  signal: AbortSignal;
}

export interface PreparedOperation {
  parameters: SubmitTransactionParams;
  /** Epoch milliseconds, at most five minutes in the future. */
  expiresAt: number;
}

export interface OperationReview<Input> {
  readonly input: Readonly<Input>;
  readonly expiresAt: number;
}

export interface UseReviewedTransactionParameters<Input> extends UseTransactionFlowParameters {
  networkId: string;
  /** Read-only registry/context preparation. Must not submit, sign, or transfer assets. */
  prepare?: (input: Input, context: OperationPreparationContext) => Promise<PreparedOperation>;
  preparationTimeoutMs?: number;
}

interface Review<Input> {
  input: Input;
  commandId: string;
  expiresAt: number;
  parameters: SubmitTransactionParams;
  identity: string;
  client: object;
  preparer: NonNullable<UseReviewedTransactionParameters<Input>['prepare']>;
  networkId: string;
}

const identity = (session: Session) => JSON.stringify([
  session.sessionId, session.walletId, session.partyId, toCAIP2Network(session.network).networkId,
]);
const errorOf = (reason: unknown) => reason instanceof Error ? reason : new Error(String(reason));
function cloneJSON<T>(value: T): T {
  const seen = new WeakSet<object>();
  function validate(item: unknown, depth: number): void {
    if (depth > 100) throw new Error('Operation JSON data is nested too deeply');
    if (item === null || item === undefined || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object' || seen.has(item) || (!Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)) {
      throw new Error('Use plain JSON data for operation inputs and commands');
    }
    seen.add(item);
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) {
        if (!(i in item) || item[i] === undefined) throw new Error('Operation JSON arrays must not contain missing values');
        validate(item[i], depth + 1);
      }
    } else for (const field of Object.values(item)) validate(field, depth + 1);
    seen.delete(item);
  }
  if (value === undefined) throw new Error('Operation input must be JSON data');
  validate(value, 0);
  return JSON.parse(JSON.stringify(value));
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Two explicit steps: prepare/review, then one wallet write. No automatic write retry. */
export function useReviewedTransaction<Input>(parameters: UseReviewedTransactionParameters<Input>) {
  const { client, session } = usePartyLayerContext();
  const flow = useTransactionFlow(parameters);
  const [review, setReview] = useState<Review<Input> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);
  const current = useRef({ client, session, parameters });
  current.current = { client, session, parameters };
  const preparation = useRef<AbortController | null>(null);
  const reviewRef = useRef<Review<Input> | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; preparation.current?.abort(); }; }, []);

  const sessionIdentity = session ? identity(session) : '';
  const supported = Boolean(client && session && !session.networkMismatch &&
    toCAIP2Network(session.network).networkId === parameters.networkId &&
    session.capabilitiesSnapshot.includes('submitTransaction') && parameters.prepare);
  const activeReview = supported && review?.identity === sessionIdentity && review.client === client &&
    review.preparer === parameters.prepare && review.networkId === parameters.networkId ? review : null;
  useEffect(() => {
    preparation.current?.abort(); reviewRef.current = null;
    setReview(null); setError(null); setLastCommandId(null);
  }, [client, sessionIdentity, parameters.networkId]);

  const discard = () => {
    if (submitting.current) return;
    preparation.current?.abort();
    reviewRef.current = null;
    setReview(null);
    setError(null);
  };

  async function prepare(input: Input): Promise<OperationReview<Input>> {
    if (preparation.current || submitting.current || flow.isPending) throw new Error('An operation is already pending');
    const captured = current.current;
    if (!supported || !captured.client || !captured.session || !captured.parameters.prepare) throw new Error('This operation is not configured for the connected wallet and network');
    const timeout = captured.parameters.preparationTimeoutMs ?? 30_000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300_000) throw new Error('Invalid operation preparation timeout');
    const capturedIdentity = identity(captured.session);
    const controller = new AbortController();
    preparation.current = controller;
    reviewRef.current = null;
    setReview(null); setError(null); setPreparing(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Clone JSON inputs before handing them to application code. A later form
      // edit or mutation of the caller's object cannot change what is reviewed.
      const snapshot: Input = freeze(cloneJSON(input));
      const preparedInput: Input = cloneJSON(snapshot);
      const commandId = crypto.randomUUID();
      const stopped = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Operation preparation cancelled or timed out')), { once: true });
        timer = setTimeout(() => controller.abort(), timeout);
      });
      const prepared = await Promise.race([captured.parameters.prepare(preparedInput, {
        walletId: String(captured.session.walletId), partyId: String(captured.session.partyId),
        networkId: captured.parameters.networkId, commandId, signal: controller.signal,
      }), stopped]);
      // Snapshot returned command data before the following asynchronous session
      // lookup. The application may otherwise reuse/mutate its returned object.
      const normalized: PreparedOperation = cloneJSON(prepared);
      const live = await Promise.race([captured.client.getActiveSession(), stopped]);
      if (!mounted.current || controller.signal.aborted || !live || live.networkMismatch || identity(live) !== capturedIdentity ||
        current.current.client !== captured.client || !current.current.session || identity(current.current.session) !== capturedIdentity ||
        current.current.parameters.prepare !== captured.parameters.prepare || current.current.parameters.networkId !== captured.parameters.networkId) {
        throw new Error('Wallet session or operation configuration changed during preparation');
      }
      const tx = normalized?.parameters?.signedTx;
      if (!tx || typeof tx !== 'object' || Array.isArray(tx) || !('commandId' in tx) || tx.commandId !== commandId ||
        !Number.isSafeInteger(normalized.expiresAt) || normalized.expiresAt <= Date.now() || normalized.expiresAt > Date.now() + 300_000) {
        throw new Error('Preparation returned an unbound command or invalid expiry');
      }
      const next: Review<Input> = { input: snapshot, commandId, expiresAt: normalized.expiresAt,
        parameters: normalized.parameters, identity: capturedIdentity,
        client: captured.client, preparer: captured.parameters.prepare, networkId: captured.parameters.networkId };
      reviewRef.current = next;
      setReview(next);
      // Never expose the internal mutable command, client or route binding.
      return Object.freeze({ input: snapshot, expiresAt: next.expiresAt });
    } catch (reason) {
      if (mounted.current) setError(errorOf(reason));
      throw reason;
    } finally {
      if (timer) clearTimeout(timer);
      if (preparation.current === controller) preparation.current = null;
      if (mounted.current) setPreparing(false);
    }
  }

  async function submit() {
    if (submitting.current || preparation.current || flow.isPending) throw new Error('An operation is already pending');
    const prepared = reviewRef.current;
    if (!supported || !prepared || prepared.client !== current.current.client ||
      prepared.preparer !== current.current.parameters.prepare || prepared.networkId !== current.current.parameters.networkId ||
      !current.current.session || current.current.session.networkMismatch || prepared.identity !== identity(current.current.session)) {
      throw new Error('Review this operation with the current wallet before submitting');
    }
    if (prepared.expiresAt <= Date.now()) {
      discard(); const failure = new Error('Operation preparation expired; review again'); setError(failure); throw failure;
    }
    submitting.current = true;
    // Consume before the asynchronous boundary. Even a lost response cannot
    // cause this reviewed command to be sent a second time by another click.
    reviewRef.current = null; setReview(null); setError(null);
    setLastCommandId(prepared.commandId);
    try { return await flow.submitTransaction(prepared.parameters, { commandId: prepared.commandId }); }
    catch (reason) { if (mounted.current) setError(errorOf(reason)); throw reason; }
    finally { submitting.current = false; }
  }

  return { transaction: flow.transactions.find(record => record.commandId === lastCommandId) ?? null,
    transactions: flow.transactions, isPending: flow.isPending, reconcile: flow.reconcile,
    review: activeReview ? Object.freeze({ input: activeReview.input, expiresAt: activeReview.expiresAt }) as OperationReview<Input> : null,
    error, preparing, supported, prepare, submit, discard };
}
