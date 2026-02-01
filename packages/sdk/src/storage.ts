/**
 * Encrypted session storage
 * Stores session metadata (no private keys) with encryption
 */

import type { Session } from '@partylayer/core';
// InvalidSessionError removed - use SessionExpiredError or OriginNotAllowedError instead

/**
 * Storage key prefix
 */
const STORAGE_PREFIX = 'partylayer_session_';

/**
 * Simple encryption/decryption using Web Crypto API
 * In production, consider using a more robust encryption scheme
 */
class SessionEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;

  /**
   * Generate encryption key from origin (deterministic)
   */
  private static async getKey(origin: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(origin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return crypto.subtle.importKey(
      'raw',
      hash.slice(0, this.KEY_LENGTH / 8),
      { name: this.ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt session data
   */
  static async encrypt(
    data: string,
    origin: string
  ): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback for environments without Web Crypto API
      return btoa(data);
    }

    try {
      const key = await this.getKey(origin);
      const iv = crypto.getRandomValues(
        new Uint8Array(this.IV_LENGTH)
      );
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv,
        },
        key,
        encoded
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(
        iv.length + encrypted.byteLength
      );
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      // Fallback to base64 if encryption fails
      return btoa(data);
    }
  }

  /**
   * Decrypt session data
   */
  static async decrypt(
    encrypted: string,
    origin: string
  ): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback for environments without Web Crypto API
      return atob(encrypted);
    }

    try {
      const key = await this.getKey(origin);
      const combined = Uint8Array.from(
        atob(encrypted),
        (c) => c.charCodeAt(0)
      );

      const iv = combined.slice(0, this.IV_LENGTH);
      const data = combined.slice(this.IV_LENGTH);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv,
        },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      // Fallback to base64 if decryption fails
      return atob(encrypted);
    }
  }
}

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

      const decrypted = await SessionEncryption.decrypt(
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
      const encrypted = await SessionEncryption.encrypt(data, this.origin);
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
