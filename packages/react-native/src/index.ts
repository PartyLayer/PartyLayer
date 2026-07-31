/**
 * @partylayer/react-native: the headless entrypoint.
 *
 * Provides the pieces that let the framework-agnostic core run on React Native: the
 * client factory, AsyncStorage session storage, a `DeepLinkPlatform` built on RN's
 * `Linking`, the theme bridge, the wallets and connect hooks, and per-wallet icon data.
 * The UI components live in the separate "./ui" entrypoint, so a dApp using only the
 * hooks never installs the SVG renderer.
 */

export { createReactNativeDeepLinkPlatform } from './deeplink-platform';
export { createAsyncStorage, createAsyncStorageAdapter } from './storage';
export { createReactNativeClient } from './client';
export type { ReactNativeClientConfig } from './client';
export type { RNLinking, RNAsyncStorage } from './types';

// Theme bridge: the six families adapted for React Native.
export {
  toReactNativeTheme,
  toThemeTokens,
  parseBorderRadius,
  themes,
  REM_BASE_PX,
  DEFAULT_BORDER_RADIUS,
  applyAccent,
  accentPresets,
} from './theme';
export type {
  ReactNativeTheme,
  PartyLayerTheme,
  ThemeFamily,
  AccentOverrides,
  AccentPreset,
} from './theme';

// Headless hooks: wallets and connect, built on the client factory above.
export { useWallets } from './use-wallets';
export type { UseWalletsParameters, UseWalletsResult } from './use-wallets';
export { useConnect } from './use-connect';
export type { UseConnectResult, ConnectStatus } from './use-connect';

// Icon data: per-wallet URL plus a format hint for the UI components.
export { deriveIconFormat, walletIconInfo } from './icons';
export type { IconFormat, WalletIconInfo } from './icons';
