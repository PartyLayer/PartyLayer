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
  | ErrorEvent;

/**
 * Event handler type
 */
export type EventHandler<T extends PartyLayerEvent = PartyLayerEvent> = (
  event: T
) => void | Promise<void>;
