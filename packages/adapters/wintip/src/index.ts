/**
 * @partylayer/adapter-wintip
 * Wintip Wallet adapter for PartyLayer.
 */

export { WintipAdapter } from './wintip-adapter';
export {
  WintipNotInstalledError,
  WintipRpcErrorCode,
  isWintipRpcError,
  mapWintipError,
} from './errors';
export {
  WINTIP_HOMEPAGE,
  WINTIP_INSTALL_URL,
  WINTIP_PROVIDER_ID,
  WINTIP_PROVIDER_SCRIPT_URL,
  WINTIP_SUPPORTED_NETWORKS,
  WINTIP_WALLET_ID,
  WINTIP_WALLET_URL,
} from './constants';
export type {
  WintipAccount,
  WintipConnectResult,
  WintipEventListener,
  WintipPrepareExecuteResponse,
  WintipPrepareSubmissionRequest,
  WintipProviderInfo,
  WintipStatusEvent,
  WintipTxChangedEvent,
  WintipTxResult,
} from './types';
