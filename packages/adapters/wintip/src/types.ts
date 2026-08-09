/**
 * Wintip Wallet's own CIP-0103 RPC shapes. Mirrors wallet/lib/cip103/types.ts
 * and rpcServer.ts in the wintip.cc repo (not re-exported from there — this
 * package has no dependency on that app, just a structural match).
 */

export interface WintipAccount {
  partyId: string;
  status: 'initializing' | 'allocated' | 'removed';
  hint: string;
  /** Always '' — Wintip is custodial and has no per-user signing key. */
  publicKey: string;
  namespace: string;
  networkId: string;
  signingProviderId: string;
  primary: boolean;
  disabled: boolean;
}

export interface WintipConnectResult {
  isConnected: boolean;
  isNetworkConnected: boolean;
  reason?: string;
}

export interface WintipProviderInfo {
  id: string;
  version: string;
  providerType: 'browser' | 'desktop' | 'mobile' | 'remote';
}

export interface WintipStatusEvent {
  provider: WintipProviderInfo;
  connection: WintipConnectResult;
  network?: { networkId: string };
}

export interface WintipPrepareSubmissionRequest {
  commands: unknown[];
  commandId?: string;
  actAs?: string[];
  readAs?: string[];
  disclosedContracts?: unknown[];
  synchronizerId?: string;
  packageIdSelectionPreference?: string[];
}

/**
 * Result shape of prepareExecuteAndWait. NOTE: Wintip's real response puts
 * updateId/completionOffset directly on `tx` (flat) rather than nested under
 * `tx.payload` like the canonical CIP0103TxExecutedPayload — both call sites
 * below read defensively (flat first, nested fallback) so this still works
 * if Wintip's bridge is ever made more strictly spec-conformant later.
 */
export interface WintipTxResult {
  status: 'executed' | 'failed';
  commandId: string;
  updateId?: string;
  completionOffset?: number;
  payload?: { updateId?: string; completionOffset?: number };
}

export interface WintipPrepareExecuteResponse {
  tx: WintipTxResult;
}

export interface WintipTxChangedEvent {
  status: 'pending' | 'executed' | 'failed';
  commandId: string;
  updateId?: string;
  completionOffset?: number;
  payload?: { updateId?: string; completionOffset?: number };
  error?: { code: number; message: string; data?: unknown };
}

export type WintipEventListener = (...args: unknown[]) => void;
