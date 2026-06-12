/**
 * @partylayer/adapter-walley
 * Walley Wallet adapter for PartyLayer.
 *
 * Walley is a self-custodial Canton wallet (https://walley.cc). Keys are
 * derived in-browser from a WebAuthn passkey; dApps connect through a popup
 * JSON-RPC bridge on the Walley host.
 */

export { WalleyAdapter } from './walley-adapter';
export type { WalleyAdapterConfig } from './walley-adapter';
export { WalleyPopupTransport } from './popup-transport';
export type { PopupSendOptions } from './popup-transport';
export { WalleyNotAvailableError, WalleyPopupBlockedError } from './errors';
export {
  WALLEY_HOMEPAGE,
  WALLEY_HOSTS,
  WALLEY_INSTALL_URL,
  WALLEY_POPUP_PATHS,
  WALLEY_SIGNING_METHOD,
  WALLEY_SUPPORTED_NETWORKS,
  WALLEY_WALLET_ID,
  resolveWalleyHost,
} from './constants';
export type {
  WalleyConnectParams,
  WalleyConnectResult,
  WalleyDisclosedContract,
  WalleyPrepareExecuteParams,
  WalleyPrepareExecuteResult,
  WalleySignMessageParams,
  WalleySignMessageResult,
} from './types';
