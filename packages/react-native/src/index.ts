/**
 * @partylayer/react-native: the headless entrypoint.
 *
 * Provides the pieces that let the framework-agnostic core run on React Native: the
 * client factory, AsyncStorage session storage, a `DeepLinkPlatform` built on RN's
 * `Linking`, the theme bridge, the wallets and connect hooks, and per-wallet icon data.
 * The UI components live in the separate "./ui" entrypoint, so a dApp using only the
 * hooks never installs the SVG renderer.
 */

// Provider and context: optional. Every hook below also takes an explicit client, so an
// app written against 0.2.2 needs no provider anywhere.
export { PartyLayerProvider, usePartyLayerContext, usePartyLayer } from './context';
export type { PartyLayerProviderProps, PartyLayerContextValue } from './context';

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

// Account and session hooks over the shared session store. These read the store the
// provider creates, so they require PartyLayerProvider.
export { useAccount, useSession, useAccountEffect } from './session-hooks';
export type {
  UseAccountResult,
  UseSessionResult,
  UseAccountEffectParameters,
  SessionChain,
} from './session-hooks';
export { useDisconnect } from './use-disconnect';

// Transaction hooks. These add no capability logic: the sdk client guards each method and
// throws CapabilityNotSupportedError, which passes through unchanged.
export {
  useSignMessage,
  useSignTransaction,
  useSubmitTransaction,
  useLedgerApi,
} from './transaction-hooks';
export type {
  UseSignMessageResult,
  UseSignTransactionResult,
  UseSubmitTransactionResult,
  UseLedgerApiResult,
} from './transaction-hooks';
export type { UseDisconnectResult } from './use-disconnect';

// Headless hooks: wallets and connect, built on the client factory above.
export { useWallets } from './use-wallets';
export type { UseWalletsParameters, UseWalletsResult } from './use-wallets';
export { useConnect } from './use-connect';
export type { UseConnectResult, ConnectStatus } from './use-connect';

// Theme provider and hook. Composes with the per component `theme` prop: the prop wins,
// then this context, then the default. `useTheme` falls back rather than throwing.
export { ThemeProvider, useTheme } from './theme-context';
export type {
  ThemeProviderProps,
  ReactNativeThemeInput,
  DynamicReactNativeTheme,
} from './theme-context';

// Icon data: per-wallet URL plus a format hint for the UI components.
export { deriveIconFormat, walletIconInfo } from './icons';
export type { IconFormat, WalletIconInfo } from './icons';
