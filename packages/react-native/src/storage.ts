/**
 * AsyncStorage backed persistence for React Native (injection form).
 *
 * `@react-native-async-storage/async-storage` is a genuinely OPTIONAL peer, so the base
 * "." entrypoint never imports it: these factories take the AsyncStorage module as an
 * argument. A consumer that wants the convenience of not passing it imports the no
 * argument factories from the "./async-storage" subpath, which statically imports the
 * package. A clear error is thrown when the passed module is missing or invalid.
 */
import type { StorageAdapter } from '@partylayer/core';
import type { SessionStorage } from '@partylayer/session';
import type { RNAsyncStorage } from './types';

function assertAsyncStorage(asyncStorage: RNAsyncStorage): RNAsyncStorage {
  if (
    !asyncStorage ||
    typeof asyncStorage.getItem !== 'function' ||
    typeof asyncStorage.setItem !== 'function' ||
    typeof asyncStorage.removeItem !== 'function'
  ) {
    throw new Error(
      'AsyncStorage is not available. Pass @react-native-async-storage/async-storage to this ' +
        'factory, or import the no argument factories from @partylayer/react-native/async-storage.',
    );
  }
  return asyncStorage;
}

/**
 * A {@link SessionStorage} backed by React Native AsyncStorage.
 * @param asyncStorage The AsyncStorage module.
 */
export function createAsyncStorage(asyncStorage: RNAsyncStorage): SessionStorage {
  const store = assertAsyncStorage(asyncStorage);
  return {
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}

/**
 * A core {@link StorageAdapter} backed by React Native AsyncStorage, for the client
 * factory (it needs the four-method surface including `clear`).
 * @param asyncStorage The AsyncStorage module.
 */
export function createAsyncStorageAdapter(asyncStorage: RNAsyncStorage): StorageAdapter {
  const store = assertAsyncStorage(asyncStorage);
  return {
    get: (key) => store.getItem(key),
    set: (key, value) => store.setItem(key, value),
    remove: (key) => store.removeItem(key),
    clear: () => store.clear(),
  };
}
