/**
 * @partylayer/react-native/async-storage: the batteries included AsyncStorage path.
 *
 * This subpath statically imports @react-native-async-storage/async-storage, so a
 * bundler includes it and the no argument factories just work. It is a separate
 * entrypoint (mirroring "./ui") so the base "." entrypoint never forces the optional
 * peer on a consumer who supplies their own storage. Using this subpath requires
 * @react-native-async-storage/async-storage to be installed; the base injection
 * factories in "." do not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter } from '@partylayer/core';
import type { SessionStorage } from '@partylayer/session';
import type { RNAsyncStorage } from './types';
import {
  createAsyncStorage as createFromModule,
  createAsyncStorageAdapter as createAdapterFromModule,
} from './storage';

/** A {@link SessionStorage} backed by the installed AsyncStorage, no argument needed. */
export function createAsyncStorage(): SessionStorage {
  return createFromModule(AsyncStorage as unknown as RNAsyncStorage);
}

/** A core {@link StorageAdapter} backed by the installed AsyncStorage, no argument needed. */
export function createAsyncStorageAdapter(): StorageAdapter {
  return createAdapterFromModule(AsyncStorage as unknown as RNAsyncStorage);
}
