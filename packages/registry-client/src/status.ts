/**
 * Registry status tracking
 */

import type { RegistryChannel } from './schema';
import type { CantonConnectError } from '@cantonconnect/core';

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
  error?: CantonConnectError;
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
