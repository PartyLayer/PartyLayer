/**
 * @partylayer/react-native: headless React Native compatibility layer (phase A).
 *
 * No UI components: this package provides the platform pieces that let the
 * framework-agnostic core run on React Native. UI components and an Expo demo follow
 * in later phases.
 */

export { createReactNativeDeepLinkPlatform } from './deeplink-platform';
export { createAsyncStorage, createAsyncStorageAdapter } from './storage';
export { createReactNativeClient } from './client';
export type { ReactNativeClientConfig } from './client';
export type { RNLinking, RNAsyncStorage } from './types';
