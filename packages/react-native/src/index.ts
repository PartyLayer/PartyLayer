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

// Theme bridge (phase B1): the six families adapted for React Native.
export {
  toReactNativeTheme,
  toThemeTokens,
  parseBorderRadius,
  themes,
  REM_BASE_PX,
  DEFAULT_BORDER_RADIUS,
} from './theme';
export type { ReactNativeTheme, PartyLayerTheme, ThemeFamily } from './theme';

// Headless hooks (phase B1): wallets and connect, built on the phase A client.
export { useWallets } from './use-wallets';
export type { UseWalletsParameters, UseWalletsResult } from './use-wallets';
export { useConnect } from './use-connect';
export type { UseConnectResult, ConnectStatus } from './use-connect';

// Icon data (phase B1): per-wallet URL plus a format hint for the component phase.
export { deriveIconFormat, walletIconInfo } from './icons';
export type { IconFormat, WalletIconInfo } from './icons';
