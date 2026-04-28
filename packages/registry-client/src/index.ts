/**
 * @partylayer/registry-client
 * Wallet registry client for PartyLayer
 */

export * from './schema';
export * from './client';
export * from './status';

// Re-export from core for convenience — detection logic now lives in core
// so adapter packages can use it without depending on registry-client's
// HTTP layer.
export {
  matchesProviderDetection,
  findMatchingWallet,
  findMatchingWalletInfo,
  deriveGenericWalletName,
} from '@partylayer/core';
export type {
  Cip0103StatusForDetection,
  ProviderDetection,
  ProviderMatcher,
  WalletInfo,
} from '@partylayer/core';
