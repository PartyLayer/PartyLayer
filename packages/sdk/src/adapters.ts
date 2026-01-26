/**
 * Default adapter implementations
 */

import type {
  StorageAdapter,
  CryptoAdapter,
  LoggerAdapter,
  TelemetryAdapter,
} from '@cantonconnect/core';

/**
 * Default logger (console-based)
 */
export class DefaultLogger implements LoggerAdapter {
  debug(message: string, ...args: unknown[]): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[CantonConnect] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (typeof console !== 'undefined' && console.info) {
      console.info(`[CantonConnect] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[CantonConnect] ${message}`, ...args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[CantonConnect] ${message}`, error, ...args);
    }
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
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback to base64
      return btoa(data);
    }

    try {
      const cryptoKey = await this.getKey(key);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoded
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch {
      return btoa(data);
    }
  }

  async decrypt(encrypted: string, key: string): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return atob(encrypted);
    }

    try {
      const cryptoKey = await this.getKey(key);
      const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch {
      return atob(encrypted);
    }
  }

  async generateKey(): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      return Math.random().toString(36).substring(2, 15);
    }

    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Default storage adapter (localStorage-based)
 */
export class DefaultStorage implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'cantonconnect_') {
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
