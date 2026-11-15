import { generateSessionId, toSessionId, type CryptoAdapter, type SessionId } from '@partylayer/core';

const SESSION_ENTROPY_BYTES = 32;

/** Native entropy is separate from encryption keys/handles and never weakly substituted. */
export function createSecureSessionId(crypto: CryptoAdapter): SessionId | Promise<SessionId> {
  if (typeof globalThis.crypto?.getRandomValues === 'function') return generateSessionId();
  if (!crypto.randomBytes) throw new Error('Secure session entropy requires platform getRandomValues or CryptoAdapter.randomBytes');
  const encode = (bytes: Uint8Array): SessionId => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== SESSION_ENTROPY_BYTES) {
      throw new Error('Session entropy must be a Uint8Array of exactly 32 bytes');
    }
    return toSessionId(`session_${Date.now()}_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`);
  };
  const bytes = crypto.randomBytes(SESSION_ENTROPY_BYTES);
  if (bytes instanceof Uint8Array) return encode(bytes);
  if (bytes && typeof bytes.then === 'function') return Promise.resolve(bytes).then(encode);
  throw new Error('Session entropy must be a Uint8Array of exactly 32 bytes');
}
