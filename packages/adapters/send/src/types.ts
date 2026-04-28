/**
 * Local Sigilry-shape types.
 *
 * The Send extension speaks the splice-wallet-kernel OpenRPC protocol via
 * `window.canton`. We could pull these definitions from `@sigilry/dapp`,
 * but pinning that dependency would couple us to Sigilry's release cadence
 * and force consumers to install Zod transitively. Instead we model the
 * minimal shapes we actually consume — fields verified against
 * `@sigilry/dapp@1.0.1` `.d.ts` files and live runtime inspection of the
 * extension's provider object.
 */

/** Methods Send exposes via `window.canton.request({ method, params })`. */
export type SendRpcMethod =
  | 'status'
  | 'connect'
  | 'disconnect'
  | 'isConnected'
  | 'getActiveNetwork'
  | 'getPrimaryAccount'
  | 'listAccounts'
  | 'prepareExecute'
  | 'prepareExecuteAndWait'
  | 'signMessage'
  | 'ledgerApi';

/** Events emitted on the provider via `.on(event, listener)`. */
export type SendEventName = 'accountsChanged' | 'txChanged';

export interface SendKernelInfo {
  /** Chrome extension ID for the running wallet kernel. */
  id: string;
  clientType: 'browser' | 'desktop' | 'mobile' | 'remote';
  url?: string;
  userUrl?: string;
}

export interface SendNetwork {
  networkId: string;
  ledgerApi?: { baseUrl: string };
}

export interface SendStatusResponse {
  kernel: SendKernelInfo;
  isConnected: boolean;
  isNetworkConnected: boolean;
  networkReason?: string;
  network?: SendNetwork;
  session?: { accessToken: string; userId: string };
}

export interface SendAccount {
  primary: boolean;
  partyId: string;
  status: 'allocated' | 'initialized' | string;
  hint: string;
  /** Base64 SPKI of the account's P-256 ECDSA public key. */
  publicKey: string;
  namespace: string;
  networkId: string;
  /** Always 'webauthn-prf' for Send today. */
  signingProviderId: string;
  externalTxId?: string;
  topologyTransactions?: string;
  disabled?: boolean;
  reason?: string;
}

export interface SendDisclosedContract {
  templateId?: string;
  contractId?: string;
  createdEventBlob: string;
  synchronizerId?: string;
}

export interface SendPrepareSubmissionRequest {
  commandId?: string;
  commands: Record<string, unknown>;
  actAs?: string[];
  readAs?: string[];
  disclosedContracts?: SendDisclosedContract[];
  synchronizerId?: string;
  packageIdSelectionPreference?: string[];
}

export interface SendTxExecutedEvent {
  status: 'executed';
  commandId: string;
  payload: { updateId: string; completionOffset: number };
}

export interface SendPrepareExecuteAndWaitResult {
  tx: SendTxExecutedEvent;
}

/** Discriminated union surfaced via the `txChanged` event. */
export type SendTxChangedEvent =
  | { status: 'pending'; commandId: string }
  | {
      status: 'signed';
      commandId: string;
      payload: { signature: string; signedBy: string; party: string };
    }
  | SendTxExecutedEvent
  | { status: 'failed'; commandId: string };

export interface SendLedgerApiRequest {
  requestMethod: 'GET' | 'POST' | 'PUT' | 'DELETE';
  resource: string;
  body?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  path?: Record<string, string>;
}

export interface SendLedgerApiResult {
  /** JSON-encoded response body; preserve verbatim. */
  response: string;
}

export interface SendSignMessageRequest {
  message: string;
}

export interface SendSignMessageResult {
  signature: string;
}

/** Raw RPC error from the extension. Mirrors JSON-RPC 2.0 `error` object. */
export interface SendRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type SendEventListener = (...args: unknown[]) => void;

/**
 * The provider injected at `window.canton` by Send.
 *
 * Strictly typed `request()` is intentionally narrowed to the methods
 * Send actually implements — passing any other method name is a compile
 * error here, even though the underlying provider would simply reject it
 * at runtime with `METHOD_NOT_FOUND`.
 */
export interface SendCantonProvider {
  request<M extends SendRpcMethod>(args: SendRpcRequest<M>): Promise<SendRpcResult<M>>;
  on(event: SendEventName, listener: SendEventListener): unknown;
  off?(event: SendEventName, listener: SendEventListener): unknown;
  removeListener?(event: SendEventName, listener: SendEventListener): unknown;
}

/** Method-name-keyed map of params + result shapes. */
export interface SendRpcSchemas {
  status: { params: void; result: SendStatusResponse };
  connect: { params: void; result: SendStatusResponse };
  disconnect: { params: void; result: null };
  isConnected: { params: void; result: SendStatusResponse };
  getActiveNetwork: { params: void; result: SendNetwork };
  getPrimaryAccount: { params: void; result: SendAccount };
  listAccounts: { params: void; result: SendAccount[] };
  prepareExecute: { params: SendPrepareSubmissionRequest; result: null };
  prepareExecuteAndWait: {
    params: SendPrepareSubmissionRequest;
    result: SendPrepareExecuteAndWaitResult;
  };
  signMessage: { params: SendSignMessageRequest; result: SendSignMessageResult };
  ledgerApi: { params: SendLedgerApiRequest; result: SendLedgerApiResult };
}

/** Method-name → `params` field shape (omitted entirely when params is void). */
export type SendRpcRequest<M extends SendRpcMethod> =
  SendRpcSchemas[M]['params'] extends void
    ? { method: M; params?: undefined }
    : { method: M; params: SendRpcSchemas[M]['params'] };

/** Method-name → result type. */
export type SendRpcResult<M extends SendRpcMethod> = SendRpcSchemas[M]['result'];

declare global {
  interface Window {
    canton?: SendCantonProvider;
  }
}
