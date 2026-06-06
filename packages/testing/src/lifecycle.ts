/**
 * Simulated, controllable transaction lifecycle.
 *
 * Exposes the session-layer view (boolean phase flags
 * isPreparing → isSubmitting → isConfirming → isFinalized, plus a `failed`
 * terminal) AND emits the SAME CIP-0103 `txChanged` events the real provider
 * emits, so tests can assert against either view.
 *
 * Two drive modes:
 *   - manual: `advance()` steps one phase at a time; `fail()` terminates.
 *   - auto:   `start()` walks all phases using configurable per-phase delays
 *             (uses setTimeout — fake-timer friendly).
 *
 * Phase → CIP-0103 `txChanged.status` mapping:
 *   preparing  → 'pending'
 *   submitting → 'signed'   (payload: { signature, signedBy, party })
 *   confirming → (no CIP-0103 status — see note)
 *   finalized  → 'executed' (payload: { updateId, completionOffset })
 *   failed     → 'failed'
 *
 * NOTE — 'confirming' has no CIP-0103 `txChanged` status: the spec's tx union
 * goes signed → executed with no intermediate "confirming" state. We still
 * model `isConfirming` as the post-signed waiting window because the session
 * layer surfaces it as a UI flag.
 *   // pass 2: the @partylayer/session lifecycle simulation will build on this
 *   // controller (cumulative flags, query-cache wiring). Do not add it here.
 */

import { CIP0103_EVENTS } from '@partylayer/core';
import type { CIP0103Provider, CIP0103TxChangedEvent } from '@partylayer/core';
import { CIP0103EventBus } from '@partylayer/provider';

export type LifecyclePhase =
  | 'idle'
  | 'preparing'
  | 'submitting'
  | 'confirming'
  | 'finalized'
  | 'failed';

/** Non-terminal forward order used by advance()/start(). */
const FORWARD: LifecyclePhase[] = [
  'idle',
  'preparing',
  'submitting',
  'confirming',
  'finalized',
];

export type LifecycleDelays = Partial<
  Record<'preparing' | 'submitting' | 'confirming' | 'finalized', number>
>;

export interface LifecycleConfig {
  /** Command id stamped on every emitted event. */
  commandId?: string;
  /** Party id used in the 'signed' payload. */
  party?: string;
  /** Signature used in the 'signed' payload. */
  signature?: string;
  /** Update id used in the 'executed' payload. */
  updateId?: string;
  /**
   * Optional provider to ALSO emit `txChanged` onto (in addition to this
   * controller's own listeners), so events surface on a mock wallet's bus.
   */
  provider?: CIP0103Provider;
  /** Per-phase delays for auto mode (`start()`). Default 0. */
  delays?: LifecycleDelays;
}

export interface TransactionLifecycle {
  readonly commandId: string;
  readonly phase: LifecyclePhase;
  readonly isPreparing: boolean;
  readonly isSubmitting: boolean;
  readonly isConfirming: boolean;
  readonly isFinalized: boolean;
  readonly isFailed: boolean;
  /** Subscribe to `txChanged`. Returns an unsubscribe function. */
  on(event: string, listener: (event: CIP0103TxChangedEvent) => void): () => void;
  /** Manual step to the next phase; emits the mapped event. Returns the new phase. */
  advance(): LifecyclePhase;
  /** Terminal failure: emits `txChanged` `{ status: 'failed' }`. */
  fail(): void;
  /** Auto mode: walk every phase with configured delays. Resolves at 'finalized'. */
  start(): Promise<void>;
  /** Reset back to 'idle' (does not emit). */
  reset(): void;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTransactionLifecycle(
  config: LifecycleConfig = {},
): TransactionLifecycle {
  const commandId = config.commandId ?? 'mock-command-1';
  const party = config.party ?? 'party::mock-1';
  const signature = config.signature ?? 'mock-signature';
  const updateId = config.updateId ?? 'mock-update-1';

  const bus = new CIP0103EventBus();
  // Held in an object so TypeScript does not flow-narrow `phase` to a literal
  // across the `await`s in start() (it is mutated indirectly via advance/fail).
  const state: { phase: LifecyclePhase } = { phase: 'idle' };

  function emit(event: CIP0103TxChangedEvent): void {
    bus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, event);
    // Mirror onto the linked provider's bus, if one was supplied.
    config.provider?.emit(CIP0103_EVENTS.TX_CHANGED, event);
  }

  /** Emit the CIP-0103 event mapped to `next` (confirming maps to nothing). */
  function emitFor(next: LifecyclePhase): void {
    switch (next) {
      case 'preparing':
        emit({ status: 'pending', commandId });
        break;
      case 'submitting':
        emit({
          status: 'signed',
          commandId,
          payload: { signature, signedBy: party, party },
        });
        break;
      case 'confirming':
        // No CIP-0103 status for 'confirming' — flag-only (see file note).
        break;
      case 'finalized':
        emit({
          status: 'executed',
          commandId,
          payload: { updateId, completionOffset: 0 },
        });
        break;
      default:
        break;
    }
  }

  function advance(): LifecyclePhase {
    if (state.phase === 'finalized' || state.phase === 'failed') return state.phase;
    const idx = FORWARD.indexOf(state.phase);
    const next = FORWARD[idx + 1];
    if (!next) return state.phase;
    state.phase = next;
    emitFor(next);
    return state.phase;
  }

  function fail(): void {
    if (state.phase === 'finalized' || state.phase === 'failed') return;
    state.phase = 'failed';
    emit({ status: 'failed', commandId });
  }

  async function start(): Promise<void> {
    // Only meaningful from a fresh/idle lifecycle.
    if (state.phase !== 'idle') return;
    const order: Array<'preparing' | 'submitting' | 'confirming' | 'finalized'> = [
      'preparing',
      'submitting',
      'confirming',
      'finalized',
    ];
    for (const step of order) {
      await wait(config.delays?.[step] ?? 0);
      // Cast widens past the `!== 'idle'` guard's narrowing above: a fail()
      // during an await can move us to the terminal state mid-loop.
      if ((state.phase as LifecyclePhase) === 'failed') return;
      advance();
    }
  }

  function reset(): void {
    state.phase = 'idle';
  }

  return {
    get commandId() {
      return commandId;
    },
    get phase() {
      return state.phase;
    },
    get isPreparing() {
      return state.phase === 'preparing';
    },
    get isSubmitting() {
      return state.phase === 'submitting';
    },
    get isConfirming() {
      return state.phase === 'confirming';
    },
    get isFinalized() {
      return state.phase === 'finalized';
    },
    get isFailed() {
      return state.phase === 'failed';
    },
    on(event, listener) {
      bus.on(event, listener);
      return () => bus.removeListener(event, listener);
    },
    advance,
    fail,
    start,
    reset,
  };
}
