/**
 * Walley error classes — subclass the closest existing PartyLayer error and
 * carry diagnostic detail in `details`.
 */

import { TransportError, WalletNotInstalledError } from '@partylayer/core';

import { WALLEY_INSTALL_URL, WALLEY_WALLET_ID } from './constants';

/** No browser/popup environment (SSR, Node). Subclasses `WalletNotInstalledError`. */
export class WalleyNotAvailableError extends WalletNotInstalledError {
  constructor(reason?: string) {
    super(
      WALLEY_WALLET_ID,
      reason ??
        `Walley requires a browser environment with popups. Visit ${WALLEY_INSTALL_URL} to get started`,
    );
    this.name = 'WalleyNotAvailableError';
    (this as { details?: Record<string, unknown> }).details = {
      ...((this as { details?: Record<string, unknown> }).details ?? {}),
      installUrl: WALLEY_INSTALL_URL,
    };
  }
}

/** Browser blocked the popup — a transport failure, not a user rejection. */
export class WalleyPopupBlockedError extends TransportError {
  constructor(host: string) {
    super(
      'Walley popup was blocked by the browser. Allow popups for this site and try again.',
      undefined,
      { walletId: WALLEY_WALLET_ID, host },
    );
    this.name = 'WalleyPopupBlockedError';
  }
}
