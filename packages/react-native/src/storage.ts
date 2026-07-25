/**
 * AsyncStorage backed persistence for React Native.
 *
 * `@react-native-async-storage/async-storage` already matches the shapes PartyLayer
 * needs, so these adapters are thin. Pass the AsyncStorage module explicitly, or call
 * with no argument to have it loaded from the peer dependency. A clear error is thrown
 * when it is not installed and none was passed.
 */
import type { StorageAdapter } from '@partylayer/core';
import type { SessionStorage } from '@partylayer/session';
import type { RNAsyncStorage } from './types';
import { loadOptionalModule } from './optional-module';

function resolveAsyncStorage(asyncStorage?: RNAsyncStorage): RNAsyncStorage {
  const resolved =
    asyncStorage ??
    loadOptionalModule<RNAsyncStorage>('@react-native-async-storage/async-storage', (mod) => {
      const m = mod as { default?: RNAsyncStorage } & RNAsyncStorage;
      return m.default ?? m;
    });
  if (
    !resolved ||
    typeof resolved.getItem !== 'function' ||
    typeof resolved.setItem !== 'function' ||
    typeof resolved.removeItem !== 'function'
  ) {
    throw new Error(
      'AsyncStorage is not available. Install @react-native-async-storage/async-storage ' +
        '(a peer dependency), or pass the module explicitly to the storage factory.',
    );
  }
  return resolved;
}

/**
 * A {@link SessionStorage} backed by React Native AsyncStorage.
 * @param asyncStorage Optional AsyncStorage module; loaded from the peer when omitted.
 */
export function createAsyncStorage(asyncStorage?: RNAsyncStorage): SessionStorage {
  const store = resolveAsyncStorage(asyncStorage);
  return {
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}

/**
 * A core {@link StorageAdapter} backed by React Native AsyncStorage, for the client
 * factory (it needs the four-method surface including `clear`).
 * @param asyncStorage Optional AsyncStorage module; loaded from the peer when omitted.
 */
export function createAsyncStorageAdapter(asyncStorage?: RNAsyncStorage): StorageAdapter {
  const store = resolveAsyncStorage(asyncStorage);
  return {
    get: (key) => store.getItem(key),
    set: (key, value) => store.setItem(key, value),
    remove: (key) => store.removeItem(key),
    clear: () => store.clear(),
  };
}
