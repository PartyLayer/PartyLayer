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

  it('prefers an explicit storage over asyncStorage when BOTH are passed', async () => {
    // Precedence is observable, not just documented: reading the active session goes
    // through the wired StorageAdapter, so only one of these two records a read.
    const seen: string[] = [];
    const storage = {
      get: async (key: string) => {
        seen.push(`storage.get:${key}`);
        return null;
      },
      set: async () => {},
      remove: async () => {},
      clear: async () => {},
    };
    const asyncStorage: RNAsyncStorage = {
      getItem: async (key) => {
        seen.push(`asyncStorage.getItem:${key}`);
        return null;
      },
      setItem: async () => {},
      removeItem: async () => {},
      clear: async () => {},
    };

    const client = createReactNativeClient({
      network: 'devnet',
      app: { name: 'RN Test' },
      adapters: [],
      storage,
      asyncStorage,
    });
    await client.getActiveSession();

    expect(seen.some((call) => call.startsWith('storage.get:'))).toBe(true);
    expect(seen.some((call) => call.startsWith('asyncStorage.getItem:'))).toBe(false);
  });

  it('falls back to the sdk default storage when neither storage nor AsyncStorage is passed', () => {
    // The base client never forces the optional AsyncStorage peer: with nothing passed it
    // uses the sdk default rather than throwing.
    const client = createReactNativeClient({ network: 'devnet', app: { name: 'RN Test' }, adapters: [] });
    expect(client).toBeInstanceOf(PartyLayerClient);
  });
});
