/**
 * @partylayer/react
 * React hooks and components for PartyLayer
 */

export * from './context';
export * from './hooks';
export * from './modal';

// PartyLayerKit — zero-config wrapper
export { PartyLayerKit } from './kit';
export type { PartyLayerKitProps } from './kit';

// ConnectButton — RainbowKit-style connection button
export { ConnectButton, truncatePartyId } from './connect-button';
export type { ConnectButtonProps } from './connect-button';

// Theme system
export { ThemeProvider, useTheme, lightTheme, darkTheme } from './theme';
export type { PartyLayerTheme } from './theme';

// Backward compatibility aliases
export { PartyLayerProvider as CantonConnectProvider } from './context';
export { usePartyLayer as useCantonConnect } from './hooks';

// Re-export registry status type
export type { RegistryStatus } from '@partylayer/registry-client';
