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

/**
 * The CIP-0103 surface this SDK speaks.
 *
 * NOT the specification's method table. This list is a superset of it by one
 * entry, and that is deliberate; see PREPARE_EXECUTE_AND_WAIT below. For the
 * spec's table, which is what we assert against other people's wallets, use
 * CIP0103_MANDATORY_METHODS.
 */
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
  /**
   * CLIENT, NOT SPEC. Do not remove this to "match the standard".
   *
   * `prepareExecuteAndWait` is declared in the RpcTypes map published by
   * @canton-network/core-wallet-dapp-rpc-client (read at 1.11.0), returning
   * `{ tx: TxChangedExecutedEvent }`. It is ABSENT from the CIP-0103
   * specification's synchronous method table, where `prepareExecute` returns
   * void and the outcome arrives as a `txChanged` event.
   *
   * It is here because two adapters in this repository call it: a single call
   * that returns the executed transaction is far easier to build a UI around
   * than a void call plus an event subscription. It belongs in the surface we
   * speak. It does NOT belong in what we require of anyone else.
   */
  PREPARE_EXECUTE_AND_WAIT: 'prepareExecuteAndWait',
} as const;

export type CIP0103Method = (typeof CIP0103_METHODS)[keyof typeof CIP0103_METHODS];

/**
 * The methods the CIP-0103 specification mandates. Exactly ten.
 *
 * WRITTEN OUT, NOT DERIVED, and that is the whole point. This used to be
 * `Object.values(CIP0103_METHODS)`, which quietly coupled two different things:
 * the surface this SDK speaks, and the surface we hold other people's wallets
 * to.
 *
 * This list is the yardstick. The conformance suite we publish iterates it and
 * a wallet vendor reads the resulting report. Deriving it from CIP0103_METHODS
 * means our own extensions arrive in that report as their obligations, which is
 * us telling another team the standard requires something it does not. That is
 * the same class of error as the wallet-support claim retracted in
 * CONTRIBUTING.md, "A document citing no source outside itself is not
 * evidence", and it reaches further because it arrives as a test result.
 *
 * So: add to CIP0103_METHODS when this SDK learns to speak something new. Add
 * here only when the SPECIFICATION changes, citing the change.
 * `cip0103-mandatory-methods.test.ts` fails if the two are recoupled.
 */
export const CIP0103_MANDATORY_METHODS: readonly CIP0103Method[] = [
  // Written out, not derived and not referenced off CIP0103_METHODS. Both
  // alternatives were measured: referencing the members keeps that object alive
  // in every consumer's bundle and cost MORE than repeating the strings, which
  // minify and gzip well next to their own copies in the object literal.
  // PREPARE_EXECUTE_AND_WAIT is absent on purpose; see above.
  'connect',
  'disconnect',
  'isConnected',
  'status',
  'getActiveNetwork',
  'listAccounts',
  'getPrimaryAccount',
  'signMessage',
  'prepareExecute',
  'ledgerApi',
] as const;

// ─── Canonical Event Names ───────────────────────────────────────────────────

export const CIP0103_EVENTS = {
  STATUS_CHANGED: 'statusChanged',
  ACCOUNTS_CHANGED: 'accountsChanged',
  TX_CHANGED: 'txChanged',
  /** Emitted when async connect completes */
  CONNECTED: 'connected',
} as const;

export type CIP0103Event = (typeof CIP0103_EVENTS)[keyof typeof CIP0103_EVENTS];
