/**
 * Encrypted session storage
 * Stores session metadata (no private keys) with encryption
 */

import type { Session } from '@partylayer/core';
import { DefaultCrypto } from './adapters';
// InvalidSessionError removed - use SessionExpiredError or OriginNotAllowedError instead

/**
 * Storage key prefix
 */
const STORAGE_PREFIX = 'partylayer_session_';

/** Legacy storage shares the SDK's authenticated, fail-closed AES cache codec. */
const sessionEncryption = new DefaultCrypto();

/**
 * Session storage interface
 */
export interface SessionStorage {
  get(sessionId: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  remove(sessionId: string): Promise<void>;
  getAll(): Promise<Session[]>;
  clear(): Promise<void>;
}

/**
 * LocalStorage-based session storage with encryption
 */
export class LocalSessionStorage implements SessionStorage {
  private origin: string;

  constructor(origin: string) {
    this.origin = origin;
  }

  async get(sessionId: string): Promise<Session | null> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const key = `${STORAGE_PREFIX}${sessionId}`;
      const encrypted = localStorage.getItem(key);

      if (!encrypted) {
        return null;
      }

      const decrypted = await sessionEncryption.decrypt(
        encrypted,
        this.origin
      );
      const session = JSON.parse(decrypted) as Session;

      // Validate origin matches
      if (session.origin !== this.origin) {
        // Return null instead of throwing - origin mismatch means session is invalid for this origin
        return null;
      }

      return session;
    } catch (error) {
      // If decryption/parsing fails, remove invalid entry
      await this.remove(sessionId);
      return null;
    }
  }

  async set(session: Session): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const key = `${STORAGE_PREFIX}${session.sessionId}`;
      const data = JSON.stringify(session);
      const encrypted = await sessionEncryption.encrypt(data, this.origin);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      // Silently fail if storage is unavailable
    }
  }

  async remove(sessionId: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const key = `${STORAGE_PREFIX}${sessionId}`;
      localStorage.removeItem(key);
    } catch (error) {
      // Silently fail if storage is unavailable
    }
  }

  async getAll(): Promise<Session[]> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const sessions: Session[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const sessionId = key.substring(STORAGE_PREFIX.length);
          const session = await this.get(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
      }
    } catch (error) {
      // Return empty array on error
    }

    return sessions;
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Silently fail if storage is unavailable
    }
  }
}

/**
 * Memory-based session storage (for testing/server-side)
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, Session>();

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async remove(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async getAll(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}
