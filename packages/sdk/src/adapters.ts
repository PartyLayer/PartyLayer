/**
 * Default adapter implementations
 */

import type {
  StorageAdapter,
  CryptoAdapter,
  LoggerAdapter,
  TelemetryAdapter,
} from '@partylayer/core';

/**
 * Default logger (console-based)
 */
/**
 * Default logger: a NO-OP.
 *
 * A kit stays silent unless the application opts in. With no logger configured the
 * client prints nothing, so a peer kit never writes to a dApp's console uninvited.
 * To restore console output, pass the standard `console` as the logger, which
 * satisfies the LoggerAdapter shape:
 *
 *   createPartyLayer({ ...config, logger: console });
 *
 * Verbosity is then controlled by `logLevel` on the config (default `info`).
 */
export class DefaultLogger implements LoggerAdapter {
  debug(_message: string, ..._args: unknown[]): void {
    // No-op: silent by default.
  }

  info(_message: string, ..._args: unknown[]): void {
    // No-op: silent by default.
  }

  warn(_message: string, ..._args: unknown[]): void {
    // No-op: silent by default.
  }

  error(_message: string, _error?: unknown, ..._args: unknown[]): void {
    // No-op: silent by default.
  }
}

/**
 * Default crypto adapter (Web Crypto API)
 */
export class DefaultCrypto implements CryptoAdapter {
  private async getKey(origin: string): Promise<CryptoKey> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(origin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return crypto.subtle.importKey(
      'raw',
      hash.slice(0, 32),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: string, key: string): Promise<string> {
    const iv = new Uint8Array(this.randomBytes(12));
    const cryptoKey = await this.getKey(key);
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(data)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv); combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encrypted: string, key: string): Promise<string> {
    const cryptoKey = await this.getKey(key);
    const combined = Uint8Array.from(atob(encrypted), character => character.charCodeAt(0));
    if (combined.length < 28) throw new Error('Invalid AES-GCM session ciphertext');
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) }, cryptoKey, combined.slice(12)
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
  }

  randomBytes(byteLength: number): Uint8Array {
    if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random entropy is unavailable');
    if (!Number.isInteger(byteLength) || byteLength < 1 || byteLength > 65_536) throw new Error('Invalid secure byte length');
    return globalThis.crypto.getRandomValues(new Uint8Array(byteLength));
  }

  async generateKey(): Promise<string> {
    return Array.from(this.randomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Default storage adapter (localStorage-based)
 */
export class DefaultStorage implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'partylayer_') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      return localStorage.getItem(`${this.prefix}${key}`);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem(`${this.prefix}${key}`, value);
    } catch {
      // Ignore storage errors
    }
  }

  async remove(key: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(`${this.prefix}${key}`);
    } catch {
      // Ignore storage errors
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Default telemetry adapter (no-op)
 */
export class DefaultTelemetry implements TelemetryAdapter {
  track(_event: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  error(_error: Error, _properties?: Record<string, unknown>): void {
    // No-op
  }
}
