/**
 * Registry status tracking
 */

import type { RegistryChannel } from './schema';
import type { PartyLayerError } from '@partylayer/core';

/**
 * Registry status information
 */
export interface RegistryStatus {
  /** Source of registry data */
  source: 'network' | 'cache';
  /** Whether signature was verified */
  verified: boolean;
  /** Registry channel */
  channel: RegistryChannel;
  /** Sequence number */
  sequence: number;
  /** Whether registry is stale (past TTL) */
  stale: boolean;
  /** When registry was fetched */
  fetchedAt: number;
  /** ETag from last successful fetch */
  etag?: string;
  /** Error if verification/fetch failed */
  error?: PartyLayerError;
}

/**
 * Cached registry snapshot
 */
export interface CachedRegistry {
  /** Registry data */
  registry: import('./schema').WalletRegistryV1;
  /** Whether signature was verified */
  verified: boolean;
  /** When fetched */
  fetchedAt: number;
  /** ETag */
  etag?: string;
  /** Sequence number */
  sequence: number;
  /** Exact signed bytes, retained for re-verification after a process restart/key rotation. */
  registryJson?: string;
  signature?: import('./schema').RegistrySignature;
}

/**
 * Last fetch attempt info
 */
export interface LastFetchAttempt {
  /** When attempted */
  fetchedAt: number;
  /** Error code if failed */
  errorCode?: string;
}
