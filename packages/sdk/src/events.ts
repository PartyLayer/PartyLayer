/**
 * Event types for PartyLayer SDK
 */

import type {
  Session,
  SessionId,
  TransactionHash,
  TransactionStatus,
} from '@partylayer/core';

/**
 * Registry updated event
 */
export interface RegistryUpdatedEvent {
  type: 'registry:updated';
  channel: 'stable' | 'beta';
  version: string;
}

/**
 * Registry status event
 */
export interface RegistryStatusEvent {
  type: 'registry:status';
  status: {
    source: 'network' | 'cache';
    verified: boolean;
    channel: 'stable' | 'beta';
    sequence: number;
    stale: boolean;
    fetchedAt: number;
    etag?: string;
    error?: Error;
  };
}

/**
 * Session connected event
 */
export interface SessionConnectedEvent {
  type: 'session:connected';
  session: Session;
}

/**
 * Session disconnected event
 */
export interface SessionDisconnectedEvent {
  type: 'session:disconnected';
  sessionId: SessionId;
  reason?: string;
}

/**
 * Session expired event
 */
export interface SessionExpiredEvent {
  type: 'session:expired';
  sessionId: SessionId;
}

/**
 * Network mismatch event — the connected wallet's effective network differs
 * from the dApp's configured network. Emitted under ALL policies (informational);
 * `enforced` is true when the active policy ('guard' | 'strict') will block.
 */
export interface SessionNetworkMismatchEvent {
  type: 'session:networkMismatch';
  sessionId: SessionId;
  /** dApp-configured (expected) network, CAIP-2 normalized. */
  expected: string;
  /** Wallet-reported (actual) network, CAIP-2 normalized. */
  actual: string;
  /** Whether the active policy will block (guard|strict) vs. detect-only (off). */
  enforced: boolean;
}

/**
 * Transaction status event
 */
export interface TxStatusEvent {
  type: 'tx:status';
  sessionId: SessionId;
  txId: TransactionHash;
  status: TransactionStatus;
  raw?: unknown;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  error: Error;
}

/**
 * Wallet-list changed event — the set of listable wallets changed since the last
 * `listWallets()` (e.g. a wallet announced late via `canton:announceProvider`,
 * after the picker already loaded). SIGNAL-ONLY: it carries no wallet payload
 * because `listWallets()` does registry-merge + discovery-gating + identity-
 * bridging + filtering that a raw announce doesn't reflect — the authoritative
 * read is to re-call `listWallets()` (mirrors EIP-6963/mipd: store emits, UI
 * re-reads). Emitted debounced (coalesces a burst into one). Never emitted when
 * nothing announces (byte-identical idle).
 */
export interface WalletsChangedEvent {
  type: 'wallets:changed';
  /** Why the list changed. Currently only late/inject-time announce discovery. */
  reason: 'announced';
}

/**
 * All event types
 */
export type PartyLayerEvent =
  | RegistryUpdatedEvent
  | RegistryStatusEvent
  | SessionConnectedEvent
  | SessionDisconnectedEvent
  | SessionExpiredEvent
  | SessionNetworkMismatchEvent
  | TxStatusEvent
  | WalletsChangedEvent
  | ErrorEvent;

/**
 * Event handler type
 */
export type EventHandler<T extends PartyLayerEvent = PartyLayerEvent> = (
  event: T
) => void | Promise<void>;
