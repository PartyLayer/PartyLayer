/**
 * Headless React Native client factory.
 *
 * Wires the framework-agnostic core (through the sdk's `createPartyLayer`) with the
 * React Native platform pieces, so a dApp gets a working connect and session flow with
 * no UI from us. It delegates to the sdk factory rather than inventing a parallel
 * architecture: it only wires session storage from AsyncStorage when the caller passes
 * it. Adapters come from the application's native-compatible transports; the native
 * SDK entry never imports the browser wallet catalog.
 */
import { createPartyLayer, PartyLayerClient as NativeSDKClient, type PartyLayerConfig } from './sdk-native';
import { createAsyncStorageAdapter } from './storage';
import type { RNAsyncStorage } from './types';

/** Public structural client view: externally supplied SDK clients remain compatible. */
export type PartyLayerClient = Pick<NativeSDKClient, keyof NativeSDKClient>;
/** Constructor of the native implementation bundled with this package. */
export const PartyLayerClient: new (config: PartyLayerConfig) => PartyLayerClient = NativeSDKClient;
export type { ConnectOptions, WalletFilter, PartyLayerEvent } from './sdk-native';

/** Config for the React Native client: the sdk config plus optional AsyncStorage injection. */
export interface ReactNativeClientConfig extends PartyLayerConfig {
  /**
   * AsyncStorage module for session persistence. Pass
   * `import AsyncStorage from '@react-native-async-storage/async-storage'`. Used only
   * when no explicit `storage` is set. With neither, the sdk's own default storage is
   * used, so the client never forces the optional AsyncStorage peer.
   */
  asyncStorage?: RNAsyncStorage;
}

/**
 * Create a headless PartyLayer client configured for React Native.
 *
 * Session storage is the caller's `storage` when set, else an AsyncStorage adapter when
 * `asyncStorage` is passed, else the sdk default. Other behavior follows the shared
 * SDK client through its native entry.
 */
export function createReactNativeClient(config: ReactNativeClientConfig): PartyLayerClient {
  const { asyncStorage, storage, ...rest } = config;
  const resolvedStorage = storage ?? (asyncStorage ? createAsyncStorageAdapter(asyncStorage) : undefined);
  return createPartyLayer({ ...rest, ...(resolvedStorage ? { storage: resolvedStorage } : {}) });
}
