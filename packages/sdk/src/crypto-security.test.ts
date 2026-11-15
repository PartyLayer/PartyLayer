import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { DefaultCrypto } from './adapters';

const platform = webcrypto as unknown as Crypto;
beforeEach(() => vi.stubGlobal('crypto', platform));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('default crypto fails closed', () => {
  it('never substitutes Math.random when secure entropy is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    const weak = vi.spyOn(Math, 'random');
    await expect(new DefaultCrypto().generateKey()).rejects.toThrow(/secure|crypto|random/i);
    expect(weak).not.toHaveBeenCalled();
  });

  it('rejects encryption and decryption without WebCrypto instead of base64', async () => {
    vi.stubGlobal('crypto', undefined);
    const crypto = new DefaultCrypto();
    await expect(crypto.encrypt('public session metadata', 'https://app.example')).rejects.toThrow();
    await expect(crypto.decrypt(btoa('plaintext legacy session'), 'https://app.example')).rejects.toThrow();
  });

  it('rejects an encryption primitive failure instead of returning encoded plaintext', async () => {
    vi.stubGlobal('crypto', { getRandomValues: platform.getRandomValues.bind(platform), subtle: {
      digest: platform.subtle.digest.bind(platform.subtle), importKey: platform.subtle.importKey.bind(platform.subtle),
      encrypt: async () => { throw new Error('primitive unavailable'); },
    } });
    await expect(new DefaultCrypto().encrypt('must not downgrade', 'https://app.example')).rejects.toThrow();
  });

  it('authenticates real AES-GCM ciphertext, rejects wrong keys/tampering and uses distinct IVs', async () => {
    const crypto = new DefaultCrypto(); const key = 'https://app.example'; const message = 'Canton — session metadata';
    const first = await crypto.encrypt(message, key); const second = await crypto.encrypt(message, key);
    expect(first).not.toBe(second); expect(first).not.toBe(btoa(unescape(encodeURIComponent(message))));
    expect(await crypto.decrypt(first, key)).toBe(message);
    await expect(crypto.decrypt(first, 'https://other.example')).rejects.toThrow();
    const bytes = Uint8Array.from(atob(first), c => c.charCodeAt(0)); bytes[bytes.length - 1] ^= 1;
    await expect(crypto.decrypt(btoa(String.fromCharCode(...bytes)), key)).rejects.toThrow();
    await expect(crypto.decrypt(btoa(JSON.stringify({ sessionId: 'weak-cache' })), key)).rejects.toThrow();
  });

  it('preserves the valid legacy AES-GCM cache layout without accepting corrupt data', async () => {
    const origin = 'https://legacy.example'; const message = JSON.stringify({ sessionId: 'legacy-opaque-session' });
    const hash = await platform.subtle.digest('SHA-256', new TextEncoder().encode(origin));
    const key = await platform.subtle.importKey('raw', hash.slice(0, 32), 'AES-GCM', false, ['encrypt']);
    const iv = platform.getRandomValues(new Uint8Array(12));
    const ciphertext = await platform.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(message));
    const legacy = new Uint8Array(iv.length + ciphertext.byteLength); legacy.set(iv); legacy.set(new Uint8Array(ciphertext), iv.length);
    expect(await new DefaultCrypto().decrypt(btoa(String.fromCharCode(...legacy)), origin)).toBe(message);
  });
});
