/**
 * Wire types for Walley's dApp popup bridge, mirroring the JSON-RPC surface of
 * `@k2flabs/walley-dapp-sdk`. Re-declared locally to keep the adapter dependency-light.
 */

/** Optional params accepted by the `connect` method. */
export interface WalleyConnectParams {
  /** When set, Walley signs this message as part of the connect approval and
   *  returns the signature on {@link WalleyConnectResult.signature}. */
  signMessage?: { message: string };
}

/** Resolved payload from the `/dapp/connect` popup. */
export interface WalleyConnectResult {
  partyId: string;
  partyHint: string;
  publicKeyFingerprint: string;
  publicKeyBase64: string;
  networkId: string;
  /** Bearer token for `ledgerApi` calls. Short-lived; on a 401, re-connect. */
  accessToken?: string;
  /** Unix seconds at which `accessToken` expires. */
  expiresAt?: number;
  /** Base URL of the wallet's ledger proxy. */
  apiBaseUrl?: string;
  /** Base64 Ed25519 signature, present only when `connect` carried a
   *  `signMessage` request. */
  signature?: string;
}

/** Params for the `signMessage` method. */
export interface WalleySignMessageParams {
  message: string;
}

/** Resolved payload from the `/dapp/sign` popup. */
export interface WalleySignMessageResult {
  /** Base64 Ed25519 signature. */
  signature: string;
}

/** A disclosed contract forwarded with an execute request. */
export interface WalleyDisclosedContract {
  templateId?: string;
  contractId?: string;
  createdEventBlob?: string;
  synchronizerId?: string;
}

/**
 * Params for the `prepareExecute` / `prepareExecuteAndWait` methods. Mirrors
 * CIP-0103 `PrepareExecuteParams`. `commands` is left as `unknown[]` because
 * the Daml command shape is application-specific.
 */
export interface WalleyPrepareExecuteParams {
  commands: unknown[];
  commandId?: string;
  actAs?: string[];
  readAs?: string[];
  disclosedContracts?: WalleyDisclosedContract[];
  synchronizerId?: string;
  packageIdSelectionPreference?: string[];
}

/**
 * Resolved payload from `prepareExecuteAndWait`. Walley's current execute page
 * resolves `null` once the user approves; future versions are expected to
 * populate `updateId` / `commandId`, so both are read defensively.
 */
export interface WalleyPrepareExecuteResult {
  updateId?: string;
  commandId?: string;
  completionOffset?: string;
}
