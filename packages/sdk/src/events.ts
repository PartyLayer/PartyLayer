/**
 * Event types for CantonConnect SDK
 */

import type {
  Session,
  SessionId,
  TransactionHash,
  TransactionStatus,
} from '@cantonconnect/core';

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
export type CantonConnectEvent =
  | RegistryUpdatedEvent
  | RegistryStatusEvent
  | SessionConnectedEvent
  | SessionDisconnectedEvent
  | SessionExpiredEvent
  | TxStatusEvent
  | ErrorEvent;

/**
 * Event handler type
 */
export type EventHandler<T extends CantonConnectEvent = CantonConnectEvent> = (
  event: T
) => void | Promise<void>;
