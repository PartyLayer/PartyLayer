/**
 * Headless client factory tests. The RN modules are mocked; no device runs here.
 */
import { describe, it, expect } from 'vitest';
import { PartyLayerClient } from '@partylayer/sdk';
import { createReactNativeClient } from '../client';
import type { RNAsyncStorage } from '../types';

function memoryAsyncStorage(): RNAsyncStorage {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
    clear: async () => {
      map.clear();
    },
  };
}

describe('createReactNativeClient', () => {
  it('returns a working client wired with AsyncStorage', () => {
    const client = createReactNativeClient({
      network: 'devnet',
      app: { name: 'RN Test' },
      adapters: [],
      asyncStorage: memoryAsyncStorage(),
    });
    expect(client).toBeInstanceOf(PartyLayerClient);
  });

  it('uses an explicitly provided storage without touching AsyncStorage', () => {
    const storage = {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
      clear: async () => {},
    };
    // No asyncStorage passed and none installed, but explicit storage means the
    // AsyncStorage path is never taken, so this must not throw.
    const client = createReactNativeClient({
      network: 'devnet',
      app: { name: 'RN Test' },
      adapters: [],
      storage,
    });
    expect(client).toBeInstanceOf(PartyLayerClient);
  });

  it('throws a clear error when neither storage nor AsyncStorage is available', () => {
    expect(() =>
      createReactNativeClient({ network: 'devnet', app: { name: 'RN Test' }, adapters: [] }),
    ).toThrow(/AsyncStorage is not available/);
  });
});
