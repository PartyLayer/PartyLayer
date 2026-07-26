/**
 * AsyncStorage session store tests (AsyncStorage mocked).
 *
 * CI has no RN runtime, so AsyncStorage is an in-memory mock; the optional peer is not
 * installed, which is what makes the not-installed path testable.
 */
import { describe, it, expect } from 'vitest';
import { createAsyncStorage, createAsyncStorageAdapter } from '../storage';
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

describe('createAsyncStorage (SessionStorage)', () => {
  it('round trips values', async () => {
    const storage = createAsyncStorage(memoryAsyncStorage());
    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('throws a clear error when passed a missing or invalid module', () => {
    expect(() => createAsyncStorage(undefined as unknown as RNAsyncStorage)).toThrow(/AsyncStorage is not available/);
    expect(() => createAsyncStorage({} as unknown as RNAsyncStorage)).toThrow(/AsyncStorage is not available/);
  });
});

describe('createAsyncStorageAdapter (core StorageAdapter)', () => {
  it('round trips values and clears', async () => {
    const backing = memoryAsyncStorage();
    const adapter = createAsyncStorageAdapter(backing);
    await adapter.set('a', '1');
    expect(await adapter.get('a')).toBe('1');
    await adapter.remove('a');
    expect(await adapter.get('a')).toBeNull();
    await adapter.set('b', '2');
    await adapter.clear();
    expect(await adapter.get('b')).toBeNull();
  });

  it('throws a clear error when passed a missing or invalid module', () => {
    expect(() => createAsyncStorageAdapter(undefined as unknown as RNAsyncStorage)).toThrow(
      /AsyncStorage is not available/,
    );
  });
});
