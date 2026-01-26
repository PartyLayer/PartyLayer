/**
 * Session management utilities
 */

import type { Session, SessionId } from './types';
import { toSessionId } from './types';

/**
 * Generate a unique session ID
 */
export function generateSessionId(): SessionId {
  return toSessionId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
}

/**
 * Validate session structure
 */
export function validateSession(session: unknown): session is Session {
  if (typeof session !== 'object' || session === null) {
    return false;
  }

  const s = session as Record<string, unknown>;

  return (
    typeof s.sessionId === 'string' &&
    typeof s.walletId === 'string' &&
    typeof s.partyId === 'string' &&
    typeof s.network === 'string' &&
    typeof s.createdAt === 'number' &&
    typeof s.origin === 'string' &&
    Array.isArray(s.capabilitiesSnapshot)
  );
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: Session): boolean {
  if (!session.expiresAt) {
    return false; // No expiration
  }

  return Date.now() >= session.expiresAt;
}

/**
 * Create a session with default values
 */
export function createSession(
  walletId: string,
  partyId: string,
  network: string,
  origin: string,
  capabilities: string[] = [],
  expiresInMs?: number
): Session {
  const now = Date.now();
  return {
    sessionId: generateSessionId(),
    walletId: walletId as import('./types').WalletId,
    partyId: partyId as import('./types').PartyId,
    network,
    createdAt: now,
    expiresAt: expiresInMs ? now + expiresInMs : undefined,
    origin,
    capabilitiesSnapshot: capabilities as import('./types').CapabilityKey[],
  };
}
