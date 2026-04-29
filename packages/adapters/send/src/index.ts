/**
 * @partylayer/adapter-send
 * Send Canton Wallet adapter for PartyLayer.
 */

export { SendAdapter } from './send-adapter';
export { SendProvider } from './send-provider';
export {
  SendAuthTimeoutError,
  SendKernelMismatchError,
  SendNotInstalledError,
  SendRpcErrorCode,
  detectSendAuthTimeout,
  mapSigilryError,
  safePreview,
  templateIdHint,
} from './errors';
export {
  SEND_DOCS_URL,
  SEND_HOMEPAGE,
  SEND_INSTALL_URL,
  SEND_KERNEL_ID,
  SEND_SIGNING_METHOD,
  SEND_SUPPORTED_NETWORKS,
} from './constants';
export type {
  SendAccount,
  SendCantonProvider,
  SendDisclosedContract,
  SendEventListener,
  SendEventName,
  SendKernelInfo,
  SendLedgerApiRequest,
  SendLedgerApiResult,
  SendNetwork,
  SendPrepareExecuteAndWaitResult,
  SendPrepareSubmissionRequest,
  SendRpcMethod,
  SendRpcRequest,
  SendRpcResult,
  SendRpcSchemas,
  SendSignMessageRequest,
  SendSignMessageResult,
  SendStatusResponse,
  SendTxChangedEvent,
  SendTxExecutedEvent,
} from './types';
