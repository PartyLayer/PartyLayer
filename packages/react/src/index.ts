/**
 * @partylayer/react
 * React hooks and components for PartyLayer
 */

export * from './context';
export * from './hooks';
export * from './modal';

// PartyLayerKit — zero-config wrapper
export { PartyLayerKit, useWalletIcons, resolveWalletIcon } from './kit';
export type { PartyLayerKitProps, WalletIconMap } from './kit';

// ConnectButton — RainbowKit-style connection button
export { ConnectButton, truncatePartyId } from './connect-button';
export type { ConnectButtonProps } from './connect-button';

// Theme system
export { ThemeProvider, useTheme, lightTheme, darkTheme } from './theme';
export type { PartyLayerTheme } from './theme';

// Native CIP-0103 adapter (for advanced usage)
export { NativeCIP0103Adapter, createNativeAdapter, createSyntheticWalletInfo } from './native-cip0103-adapter';

// Session hooks — backed by @partylayer/session. M1-S4: `useSession` is now the
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
// Browser localStorage adapter for the session store (SSR-safe).
export { createLocalStorage } from './session-storage';

// Backward compatibility aliases
export { PartyLayerProvider as CantonConnectProvider } from './context';
export { usePartyLayer as useCantonConnect } from './hooks';

// Re-export registry status type
export type { RegistryStatus } from '@partylayer/registry-client';
