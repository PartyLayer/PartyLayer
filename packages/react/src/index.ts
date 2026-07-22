/**
 * @partylayer/react
 * React hooks and components for PartyLayer
 */

export * from './context';
export * from './hooks';
export * from './modal';

// PartyLayerKit: zero-config wrapper
export { PartyLayerKit, useWalletIcons, resolveWalletIcon } from './kit';
export type { PartyLayerKitProps, WalletIconMap } from './kit';

// ConnectButton: RainbowKit-style connection button
export { ConnectButton, truncatePartyId, PartyAvatar } from './connect-button';
export type { ConnectButtonProps, PartyAvatarProps } from './connect-button';

// CostPreview: presentational traffic-cost panel (dApp passes cost data as props)
export { CostPreview } from './cost-preview';
export type { CostPreviewProps } from './cost-preview';

// TransactionToast: presentational transaction-status toast (dApp passes mutation state as props)
export { TransactionToast } from './transaction-toast';
export type { TransactionToastProps, TransactionToastStatus } from './transaction-toast';

// SynchronizerSwitcher: presentational synchronizer picker (dApp handles onSwitch)
export { SynchronizerSwitcher } from './synchronizer-switcher';
export type { SynchronizerSwitcherProps, SynchronizerOption } from './synchronizer-switcher';

// Theme system
export { ThemeProvider, useTheme, lightTheme, darkTheme, createTheme, accentPresets } from './theme';
export type { PartyLayerTheme, ThemeOverrides, ThemeInput, DynamicTheme, CallableTheme } from './theme';

// Professional theme families (additive; original palettes, WCAG AA verified).
// Each family ships a light and a dark callable theme, plus the `themes` catalog
// (e.g. `themes.midnight.dark`) for discoverability.
export {
  midnightLightTheme,
  midnightDarkTheme,
  slateLightTheme,
  slateDarkTheme,
  tealLightTheme,
  tealDarkTheme,
  goldLightTheme,
  goldDarkTheme,
  warmLightTheme,
  warmDarkTheme,
  themes,
} from './theme';

// Native CIP-0103 adapter (for advanced usage)
export { NativeCIP0103Adapter, createNativeAdapter, createSyntheticWalletInfo } from './native-cip0103-adapter';

// Session hooks: backed by @partylayer/session. `useSession` is now the
// reactive session-store hook (UseSessionReturn); the legacy SDK-layer getter is
// preserved VERBATIM as `useClientSession` (via `export * from './hooks'`).
// Migrate `useSession()` (old) → `useClientSession()`. BREAKING note in changeset.
export { useAccount, useAccountEffect, useSession } from './session-hooks';
export type {
  UseAccountReturn,
  UseAccountEffectParameters,
  UseSessionReturn,
  SessionChain,
} from './session-hooks';
// Party-focused reactive state (the party's view of useAccount; reactive store
// state via useSyncExternalStore, NOT a TanStack query, so it lives here).
export { usePartyState } from './use-party-state';
export type { UsePartyStateReturn } from './use-party-state';
// Browser localStorage adapter for the session store (SSR-safe).
export { createLocalStorage } from './session-storage';

// Cookie-backed adapter for the session store: the SSR-friendly option, readable
// on both the server (injected adapter) and client (document.cookie). See
// cookie-storage-react.ts for the cross-boundary hydration pattern.
export { createCookieStorage, documentCookieAdapter } from './cookie-storage-react';
export type {
  CookieAdapter,
  CookieStorageOptions,
  CookieSetOptions,
} from './cookie-storage-react';

// Backward compatibility aliases
export { PartyLayerProvider as CantonConnectProvider } from './context';
export { usePartyLayer as useCantonConnect } from './hooks';

// Re-export registry status type
export type { RegistryStatus } from '@partylayer/registry-client';
