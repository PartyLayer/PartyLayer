/**
 * Multi-tab session sync over BroadcastChannel (grant Milestone 1, S3).
 *
 * ADDITIVE + opt-in. Origin-bound channel name (the S1 `originTag` pattern), a
 * versioned message envelope, and graceful no-op when BroadcastChannel is
 * unavailable (SSR / Node without the global). A RECEIVING tab applies the
 * change WITHOUT rebroadcasting (loop prevention lives in the store via an
 * `applyingRemote` flag).
 *
 * VERIFIED in STEP-0: the WHATWG/Node BroadcastChannel does NOT deliver a posted
 * message back to the SENDING instance (no echo to sender), only to OTHER
 * instances on the same channel — so cross-tab fan-out works and the sender
 * never re-processes its own broadcast.
 *
 * The `channelFactory` is injectable so tests can substitute a synchronous
 * in-memory hub (deterministic, no reliance on async port delivery / event-loop
 * timers) — the "two BroadcastChannel instances simulate two tabs" harness.
 */
import { originTag } from './crypto';

/** Minimal structural subset of BroadcastChannel we depend on. */
export interface BroadcastChannelLike {
  postMessage(data: unknown): void;
  close(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

/** Factory for a channel; return `null` when broadcasting is unavailable. */
export type ChannelFactory = (name: string) => BroadcastChannelLike | null;

/** Multi-tab options. `channelFactory` defaults to the global BroadcastChannel. */
export interface BroadcastOptions {
  /** Override the channel factory (tests inject an in-memory hub). */
  channelFactory?: ChannelFactory;
}

/** Versioned cross-tab message. `kind` selects how a receiver applies it. */
export interface BroadcastEnvelope {
  readonly v: 1;
  readonly kind: 'disconnect' | 'party' | 'network';
  readonly partyId?: string | null;
  readonly networkId?: string | null;
}

const CHANNEL_PREFIX = 'partylayer.session.sync';

/** Default factory: the global BroadcastChannel, or `null` (SSR/Node-without-BC). */
export const defaultChannelFactory: ChannelFactory = (name) => {
  const BC = (globalThis as { BroadcastChannel?: new (n: string) => BroadcastChannelLike })
    .BroadcastChannel;
  if (typeof BC !== 'function') return null;
  return new BC(name);
};

/** A live multi-tab sync channel (or a no-op when unavailable). */
export interface SyncChannel {
  /** True when a real channel is backing this (false ⇒ graceful no-op). */
  readonly active: boolean;
  /** Broadcast to OTHER tabs (never echoes to this sender). */
  post(env: BroadcastEnvelope): void;
  /** Register the receive handler (one per channel). */
  onMessage(handler: (env: BroadcastEnvelope) => void): void;
  /** Close + detach. */
  close(): void;
}

/**
 * Open an origin-bound, key-scoped sync channel. Name = the S1 `originTag`
 * pattern + the store's storage key, so two tabs of the SAME origin+session
 * share one channel and different origins never cross.
 */
export function openSyncChannel(
  storageKey: string,
  options: BroadcastOptions = {},
  explicitOrigin?: string,
): SyncChannel {
  const name = `${CHANNEL_PREFIX}::${originTag(explicitOrigin)}::${storageKey}`;
  const factory = options.channelFactory ?? defaultChannelFactory;
  let ch: BroadcastChannelLike | null = null;
  try {
    ch = factory(name);
  } catch {
    ch = null; // a hostile factory must never break the store
  }

  if (!ch) {
    // Graceful no-op (SSR / Node without BroadcastChannel): single-tab still works.
    return { active: false, post() {}, onMessage() {}, close() {} };
  }

  const channel = ch;
  return {
    active: true,
    post(env) {
      try {
        channel.postMessage(env);
      } catch {
        /* best-effort; never throw into the store */
      }
    },
    onMessage(handler) {
      channel.onmessage = (ev) => {
        const env = ev?.data as BroadcastEnvelope | undefined;
        if (env && env.v === 1 && typeof env.kind === 'string') handler(env);
      };
    },
    close() {
      try {
        channel.onmessage = null;
        channel.close();
      } catch {
        /* ignore */
      }
    },
  };
}
