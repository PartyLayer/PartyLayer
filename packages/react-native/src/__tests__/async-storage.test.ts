/**
 * The "./async-storage" subpath: no-argument factories that statically import the
 * package. This exercises the REAL import path (the module is mocked, not injected), so
 * a reversion to a bundler-invisible require would fail here rather than in a browser.
 */
import { describe, it, expect, vi } from 'vitest';

// A working in-memory AsyncStorage, supplied through the module mock (the static import).
const map = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
    clear: async () => {
      map.clear();
    },
  },
}));

import { createAsyncStorage, createAsyncStorageAdapter } from '../async-storage';

describe('@partylayer/react-native/async-storage', () => {
  it('createAsyncStorage() resolves with NO argument and round trips', async () => {
    const storage = createAsyncStorage();
    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('createAsyncStorageAdapter() resolves with NO argument and clears', async () => {
    const adapter = createAsyncStorageAdapter();
    await adapter.set('a', '1');
    expect(await adapter.get('a')).toBe('1');
    await adapter.clear();
    expect(await adapter.get('a')).toBeNull();
  });
});
