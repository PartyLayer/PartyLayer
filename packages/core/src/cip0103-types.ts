/**
 * CIP-0103 dApp Standard — Canonical Type Definitions
 *
 * These types are the verbatim representation of the CIP-0103 specification.
 * They live in @partylayer/core so both @partylayer/provider and @partylayer/sdk
 * can reference them without circular dependencies.
 *
 * Reference: https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md
 *
 * IMPORTANT: Do not add PartyLayer-specific fields or aliases.
 * These types represent the standard exactly.
 */

// ─── Provider Primitives ─────────────────────────────────────────────────────

export type CIP0103EventListener<T = unknown> = (...args: T[]) => void;

export type CIP0103RequestParams = unknown[] | Record<string, unknown>;

export interface CIP0103RequestPayload {
  method: string;
  params?: CIP0103RequestParams;
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface CIP0103Provider {
  request<T = unknown>(args: CIP0103RequestPayload): Promise<T>;
  on<T = unknown>(event: string, listener: CIP0103EventListener<T>): CIP0103Provider;
  emit<T = unknown>(event: string, ...args: T[]): boolean;
  removeListener<T = unknown>(
    event: string,
    listenerToRemove: CIP0103EventListener<T>,
  ): CIP0103Provider;
}

// ─── Connection ──────────────────────────────────────────────────────────────

export interface CIP0103ConnectResult {
  isConnected: boolean;
  reason?: string;
  isNetworkConnected?: boolean;
  networkReason?: string;
  /** Async wallet extension: URL for user to complete connection */
  userUrl?: string;
}

// ─── Network (CAIP-2) ────────────────────────────────────────────────────────

export interface CIP0103Network {
  /** CAIP-2 network identifier, e.g. "canton:da-mainnet" */
  networkId: string;
  /** JSON Ledger API endpoint (if available) */
  ledgerApi?: string;
  /** Access token for Ledger API (if available) */
  accessToken?: string;
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export type CIP0103AccountStatus = 'initializing' | 'allocated';

export interface CIP0103Account {
  primary: boolean;
  partyId: string;
  status: CIP0103AccountStatus;
  hint: string;
  publicKey: string;
  namespace: string;
  /** CAIP-2 network identifier */
  networkId: string;
  signingProviderId: string;
  /**
   * Wallet-reported payout preapproval (fund-safety signal). When true, a payout
   * to this party lands directly; when false/absent, it may strand as an
   * unaccepted offer. Passthrough of what the wallet reports; absent when the
   * wallet does not report it. Do not infer this from outcomes.
   */
  hasPreapproval?: boolean;
  /** Admin party ids that can administer the payout preapproval (wallet-reported). */
  utilityPreapprovalAdmins?: string[];
}

// ─── Status ──────────────────────────────────────────────────────────────────

export type CIP0103ProviderType = 'browser' | 'desktop' | 'mobile' | 'remote';

export interface CIP0103ProviderInfo {
  id: string;
  /** dApp API version */
  version: string;
  providerType: CIP0103ProviderType;
}

export interface CIP0103StatusEvent {
  connection: CIP0103ConnectResult;
  provider: CIP0103ProviderInfo;
  network?: CIP0103Network;
  session?: {
    accessToken: string;
    userId: string;
  };
}

// ─── Transaction Lifecycle ───────────────────────────────────────────────────

export type CIP0103TxStatus = 'pending' | 'signed' | 'executed' | 'failed';

export interface CIP0103TxPendingPayload {
  status: 'pending';
  commandId: string;
}

export interface CIP0103TxSignedPayload {
  status: 'signed';
  commandId: string;
  payload: {
    signature: string;
    signedBy: string;
    party: string;
  };
}

export interface CIP0103TxExecutedPayload {
  status: 'executed';
  commandId: string;
  payload: {
    updateId: string;
    completionOffset: number;
  };
}

export interface CIP0103TxFailedPayload {
  status: 'failed';
  commandId: string;
}

export type CIP0103TxChangedEvent =
  | CIP0103TxPendingPayload
  | CIP0103TxSignedPayload
  | CIP0103TxExecutedPayload
  | CIP0103TxFailedPayload;

// ─── Ledger API ──────────────────────────────────────────────────────────────

export interface CIP0103LedgerApiRequest {
  // Canonical CIP-0103 dApp API shape (splice-wallet-kernel LedgerApiRequest):
  // LOWER-case verb enum + an OBJECT body.
  requestMethod: 'get' | 'post' | 'patch' | 'put' | 'delete';
  resource: string;
  body?: Record<string, unknown>;
}

export interface CIP0103LedgerApiResponse {
  response: string;
}

// ─── Sign Message ────────────────────────────────────────────────────────────

export interface CIP0103SignMessageRequest {
  message: string;
}

// ─── Error Model ─────────────────────────────────────────────────────────────

export interface CIP0103ProviderRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ─── Canonical Method Names ──────────────────────────────────────────────────

export const CIP0103_METHODS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  IS_CONNECTED: 'isConnected',
  STATUS: 'status',
  GET_ACTIVE_NETWORK: 'getActiveNetwork',
  LIST_ACCOUNTS: 'listAccounts',
  GET_PRIMARY_ACCOUNT: 'getPrimaryAccount',
  SIGN_MESSAGE: 'signMessage',
  PREPARE_EXECUTE: 'prepareExecute',
  LEDGER_API: 'ledgerApi',
} as const;

export type CIP0103Method = (typeof CIP0103_METHODS)[keyof typeof CIP0103_METHODS];

/** All mandatory method names as an array (useful for conformance testing) */
export const CIP0103_MANDATORY_METHODS: readonly CIP0103Method[] = Object.values(CIP0103_METHODS);

// ─── Canonical Event Names ───────────────────────────────────────────────────

export const CIP0103_EVENTS = {
  STATUS_CHANGED: 'statusChanged',
  ACCOUNTS_CHANGED: 'accountsChanged',
  TX_CHANGED: 'txChanged',
  /** Emitted when async connect completes */
  CONNECTED: 'connected',
} as const;

export type CIP0103Event = (typeof CIP0103_EVENTS)[keyof typeof CIP0103_EVENTS];
