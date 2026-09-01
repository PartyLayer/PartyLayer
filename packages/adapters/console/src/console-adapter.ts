/**
 * Console Wallet adapter implementation
 *
 * Uses the official @console-wallet/dapp-sdk which communicates with the
 * Console Wallet browser extension via window.postMessage (local mode) or
 * a relay server via QR code / deep link (remote mode).
 *
 * Connection modes:
 * - 'local'    — Browser extension only (postMessage transport)
 * - 'remote'   — Mobile wallet only (QR code / deep link via relay server)
 * - 'combined' — Auto-detects: extension if installed, otherwise QR/deep link
 *
 * Note: In 'combined' mode, the adapter resolves to 'local' or 'remote'
 * explicitly rather than passing 'combined' to the SDK, because the SDK's
 * combined mode shows its own connector-selection UI which conflicts with
 * PartyLayer's modal.
 *
 * Reference: https://www.npmjs.com/package/@console-wallet/dapp-sdk
 * Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  LedgerApiParams,
  LedgerApiResult,
  Session,
  PersistedSession,
  CapabilityKey,
  PartyId,
  TransferIntent,
  TransferResult,
} from '@partylayer/core';
import {
  normalizeLedgerMethodLower,
  ledgerApiBodyToObject,
  isRecognizedNetwork,
  toTransferIntent,
} from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toTransactionHash,
  toSignature,
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  mapUnknownErrorToPartyLayerError,
} from '@partylayer/core';
// Lazy, browser-only access to the Console Wallet SDK. A static VALUE import
// would eagerly init the SDK's localforage storage at module load, which throws
// "No available storage method found" on the server (SSR). Loading it lazily on
// first use (client-side) keeps `import '@partylayer/adapter-console'` SSR-safe.
// The `typeof import(...)` below is a TYPE position only (erased at build) and
// does not trigger the eager load.
type ConsoleWalletApi = (typeof import('@console-wallet/dapp-sdk'))['consoleWallet'];
let consoleWalletPromise: Promise<ConsoleWalletApi> | undefined;
function getConsoleWallet(): Promise<ConsoleWalletApi> {
  if (!consoleWalletPromise) {
    consoleWalletPromise = import('@console-wallet/dapp-sdk').then((m) => m.consoleWallet);
  }
  return consoleWalletPromise;
}

/**
 * Connection target for Console Wallet.
 *
 * - 'local'    — Browser extension only (postMessage)
 * - 'remote'   — Mobile wallet only (QR code / deep link relay)
 * - 'combined' — Auto-detect: extension preferred, mobile fallback (default)
 */
export type ConsoleConnectionTarget = 'local' | 'remote' | 'combined';

/**
 * Console Wallet adapter configuration
 */
export interface ConsoleAdapterConfig {
  /**
   * Connection target mode.
   *
   * - 'local'    — Extension only. Fails if extension is not installed.
   * - 'remote'   — Mobile only. Shows QR code / deep link flow.
   * - 'combined' — (Default) Tries extension, falls back to QR/deep link.
   */
  target?: ConsoleConnectionTarget;
}

/**
 * Resolve the transport label for error context and diagnostics.
 *
 * Returns a value compatible with the core error context transport type:
 * 'injected' | 'popup' | 'deeplink' | 'remote' | undefined
 *
 * For 'combined' mode with no active connection, returns undefined since
 * the actual transport is not yet determined.
 */
function resolveTransportLabel(
  target: ConsoleConnectionTarget,
  activeTransport: 'injected' | 'remote' | null,
): 'injected' | 'remote' | 'deeplink' | undefined {
  if (activeTransport) return activeTransport;
  if (target === 'local') return 'injected';
  if (target === 'remote') return 'remote';
  // Combined: transport not determined until connect succeeds
  return undefined;
}

/**
 * Base64-encode a message's UTF-8 bytes. Ported byte-for-byte from the generic
 * announce adapter's `toBase64Message` (packages/sdk/src/announce-adapter.ts) so
 * the encoding is identical to the live-validated Console signMessage call.
 */
function toBase64Message(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * How long to wait for the wallet's `executed` tx event after the user has
 * approved a transfer, before giving up and throwing.
 *
 * The wait exists because Console's `submitCommands` response does not carry an
 * update id — only the `txChanged` stream does. Timing out throws rather than
 * returning a partial result: a transfer with no update id is not a transfer we
 * can report as done.
 */
const TRANSFER_EXECUTION_TIMEOUT_MS = 120_000;

/** A Console `txChanged` event, narrowed to the fields the adapter reads. */
interface ConsoleTxEvent {
  status: string;
  commandId?: string;
  payload?: {
    signature?: string;
    updateId?: string;
    completionOffset?: number;
  };
}

/**
 * Correlates one `submitCommands` call with its `executed` event on the shared
 * `txChanged` stream.
 *
 * Console's `submitCommands` resolves with `{ status, signature }` and no
 * command id, while the update id arrives separately on `txChanged`. The link
 * between them is the signature: the `signed` event carries the same signature
 * string the call returns, and its `commandId` then identifies the `executed`
 * event to wait for.
 *
 * Events are buffered from before the call is made, because `signed` can arrive
 * before `submitCommands` resolves.
 */
class ConsoleTransferWaiter {
  private readonly buffer: ConsoleTxEvent[] = [];
  private commandId?: string;
  private settled = false;
  private resolveFn?: (value: ConsoleTxEvent) => void;
  private rejectFn?: (err: Error) => void;

  /** Feed one event from the shared stream. */
  accept(event: ConsoleTxEvent): void {
    if (this.settled) return;
    this.buffer.push(event);
    if (this.commandId) this.scanForTerminal();
  }

  /**
   * Called once `submitCommands` has resolved. Resolves the command id from the
   * signature, then settles as soon as the terminal event is present.
   */
  correlate(signature: string | undefined): void {
    if (this.settled) return;

    if (signature) {
      const signed = this.buffer.find(
        (e) => e.status === 'signed' && e.payload?.signature === signature,
      );
      if (signed?.commandId) this.commandId = signed.commandId;
    }

    if (!this.commandId) {
      // Fallback: if exactly one command was seen on the stream during this
      // call's window, it is unambiguously ours. With more than one in flight
      // we refuse rather than guess — attributing another transfer's update id
      // to this one would be worse than failing.
      const ids = [...new Set(this.buffer.map((e) => e.commandId).filter(Boolean))];
      if (ids.length === 1) this.commandId = ids[0];
    }

    if (!this.commandId) {
      this.reject(
        new Error(
          'Console Wallet did not report a command id for this transfer, so its update id cannot be identified. '
          + 'The transfer may still have been submitted; check the wallet before retrying.',
        ),
      );
      return;
    }

    this.scanForTerminal();
  }

  /** The terminal event for this transfer, or a rejection. */
  promise(): Promise<ConsoleTxEvent> {
    return new Promise<ConsoleTxEvent>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
  }

  reject(err: Error): void {
    if (this.settled) return;
    this.settled = true;
    this.rejectFn?.(err);
  }

  private scanForTerminal(): void {
    const terminal = this.buffer.find(
      (e) => e.commandId === this.commandId && (e.status === 'executed' || e.status === 'failed'),
    );
    if (!terminal) return;
    this.settled = true;
    if (terminal.status === 'failed') {
      this.rejectFn?.(new Error(`Console Wallet reported the transfer failed (commandId ${this.commandId}).`));
      return;
    }
    this.resolveFn?.(terminal);
  }
}

/**
 * Console Wallet adapter
 *
 * Implements WalletAdapter interface for Console Wallet using the official
 * dApp SDK. Supports browser extension (local), mobile QR/deep link (remote),
 * and auto-detection (combined) connection modes.
 *
 * The SDK handles transport internally:
 * - Local: window.postMessage to Chrome extension
 * - Remote: HTTP relay via consolewallet.io with QR code / deep link
 * - Combined: tries extension first, shows connector choice if unavailable
 */
export class ConsoleAdapter implements WalletAdapter {
  readonly walletId = toWalletId('console');
  readonly name = 'Console Wallet';

  private readonly target: ConsoleConnectionTarget;

  /**
   * Tracks which transport was actually used for the current connection.
   * Set during connect(), cleared on disconnect().
   * - 'injected' — connected via browser extension
   * - 'remote'   — connected via relay (QR/deep link)
   * - null       — not connected
   */
  private activeTransport: 'injected' | 'remote' | null = null;

  /** In-flight transfer waiters fed by the single shared txChanged subscription. */
  private readonly transferWaiters = new Set<ConsoleTransferWaiter>();

  /** Whether the shared txChanged subscription has been installed (once only). */
  private txStreamAttached = false;

  constructor(config: ConsoleAdapterConfig = {}) {
    this.target = config.target ?? 'combined';
  }

  getCapabilities(): CapabilityKey[] {
    const base: CapabilityKey[] = [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
      // Console satisfies both halves of the transfer contract: submitCommands
      // takes a typed transfer and prompts the user for an explicit approval,
      // and the txChanged stream carries the real ledger update id.
      'transfer',
      'events',
    ];

    switch (this.target) {
      case 'local':
        return [...base, 'injected'];
      case 'remote':
        return [...base, 'deeplink', 'remoteSigner'];
      case 'combined':
        return [...base, 'injected', 'deeplink', 'remoteSigner'];
    }
  }

  /**
   * Detect if Console Wallet is available.
   *
   * - local:    checks for browser extension via postMessage
   * - remote:   always available (SDK provides QR/deep link flow)
   * - combined: always available (extension preferred, mobile fallback)
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }

    // 'local' target: extension-only — answer matches the postMessage probe.
    if (this.target === 'local') {
      return this.detectExtension();
    }

    // 'remote' target: QR / deep-link only — there is no local install to
    // detect. Report `installed: false` so the picker accurately reflects
    // "extension not present"; connect() handles the QR / deep-link flow
    // when invoked. The contract is: detectInstalled() answers "is the
    // local install present?", not "is the wallet reachable somehow?".
    if (this.target === 'remote') {
      return {
        installed: false,
        reason:
          'Console Wallet (remote target): no local install — connect() opens QR / deep link flow',
      };
    }

    // 'combined' target: extension is the primary medium. If the extension
    // is present, that's an unambiguous "installed: true". If absent, we
    // report `false` even though the QR fallback would still work at
    // connect() time. This keeps the green-dot/grey-dot UX truthful for
    // users who read "Ready" as "extension installed". The fallback flow
    // remains intact: connect() in combined mode falls through to remote
    // (QR) when checkExtensionAvailability() reports notInstalled — see
    // the connect() implementation below.
    return this.detectExtension();
  }

  /**
   * Connect to Console Wallet.
   *
   * Passes the configured target to the SDK which handles transport selection:
   * - local: opens extension popup for user approval
   * - remote: shows QR code modal for mobile wallet scanning
   * - combined: tries extension, shows connector choice if unavailable
   */
  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId; preferInstalled?: boolean },
  ): Promise<AdapterConnectResult> {
    const transportLabel = resolveTransportLabel(this.target, null);

    try {
      // Resolve the effective SDK target.
      // We never pass 'combined' to the SDK because its combined mode shows
      // a connector-selection UI inside #console-wallet-connect-placeholder
      // which conflicts with our modal. Instead, we detect the extension
      // ourselves and pick 'local' or 'remote' explicitly.
      let effectiveTarget: 'local' | 'remote';

      if (this.target === 'local') {
        const availability =
          await (await getConsoleWallet()).checkExtensionAvailability();
        if (availability.status !== 'installed') {
          throw new WalletNotInstalledError(
            this.walletId,
            'Console Wallet extension not detected. Install from https://consolewallet.io',
          );
        }
        effectiveTarget = 'local';
      } else if (this.target === 'remote') {
        effectiveTarget = 'remote';
      } else {
        // Combined: detect extension and pick the right path.
        // If preferInstalled is explicitly false (e.g. "Try mobile" fallback),
        // force remote mode regardless of extension availability.
        if (_opts?.preferInstalled === false) {
          effectiveTarget = 'remote';
        } else {
          let extensionAvailable = false;
          try {
            const availability =
              await (await getConsoleWallet()).checkExtensionAvailability();
            extensionAvailable = availability.status === 'installed';
          } catch {
            extensionAvailable = false;
          }
          effectiveTarget = extensionAvailable ? 'local' : 'remote';
        }
      }

      ctx.logger.debug('Connecting to Console Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
        target: this.target,
        effectiveTarget,
      });

      // Connect with the resolved target — always 'local' or 'remote', never 'combined'
      const connectResult = await (await getConsoleWallet()).connect({
        name: ctx.appName,
        icon: ctx.origin ? `${ctx.origin}/favicon.ico` : undefined,
        target: effectiveTarget,
      });

      ctx.logger.debug('Console Wallet connect result', connectResult);

      if (!connectResult.isConnected) {
        throw new Error(
          connectResult.reason || 'Console Wallet connection was rejected',
        );
      }

      // Transport is known from the effective target
      this.activeTransport = effectiveTarget === 'local' ? 'injected' : 'remote';

      ctx.logger.debug('Console Wallet active transport', {
        target: this.target,
        activeTransport: this.activeTransport,
      });

      // Get primary account for party ID
      const account = await (await getConsoleWallet()).getPrimaryAccount();
      const partyIdStr = account?.partyId || `party-${Date.now()}`;

      // Get active network. Trust the wallet-reported network ONLY when it is a
      // RECOGNIZED Canton network; otherwise fall back to the dApp's configured
      // ctx.network. Mirrors the generic announce adapter (announce-adapter.ts)
      // and isRecognizedNetwork's own doc (core/src/network.ts): an UNRECOGNIZED
      // value must NOT override ctx.network. The current Console extension reports
      // the environment-agnostic label "CANTON_NETWORK" (normalizes to
      // "canton:CANTON_NETWORK" ∉ KNOWN_CAIP2), which would otherwise trip a
      // false NetworkMismatchError in the SDK's network guard.
      let networkId = ctx.network;
      try {
        const network = await (await getConsoleWallet()).getActiveNetwork();
        const reported = network?.id;
        networkId =
          [reported, ctx.network].find(
            (n): n is string => typeof n === 'string' && isRecognizedNetwork(n),
          ) ?? ctx.network;
      } catch {
        // Network query failed — use context network
      }

      // Get status for provider info
      let providerId: string | undefined;
      let providerType: string | undefined;
      try {
        const status = await (await getConsoleWallet()).status();
        providerId = status.provider?.id;
        providerType = status.provider?.providerType;
      } catch {
        // Status query optional
      }

      return {
        partyId: toPartyId(partyIdStr),
        session: {
          walletId: this.walletId,
          network: networkId,
          createdAt: Date.now(),
          metadata: {
            transport: this.activeTransport,
            ...(providerId ? { providerId } : {}),
            ...(providerType ? { providerType } : {}),
          },
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      this.activeTransport = null;
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: transportLabel,
        details: { origin: ctx.origin, network: ctx.network, target: this.target },
      });
    }
  }

  /**
   * Disconnect from Console Wallet.
   *
   * The SDK's disconnect() handles cleanup for both local and remote sessions,
   * including clearing any persisted relay session from IndexedDB.
   */
  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    try {
      await (await getConsoleWallet()).disconnect();
      ctx.logger.debug('Disconnected from Console Wallet', {
        sessionId: session.sessionId,
        transport: this.activeTransport,
      });
    } catch (err) {
      ctx.logger.warn('Error during Console Wallet disconnect', err);
    } finally {
      this.activeTransport = null;
    }
  }

  /**
   * Restore session — verify wallet is still connected.
   *
   * For local mode: checks extension availability and connection status.
   * For remote/combined mode: checks connection status via isConnected(),
   * which internally checks both extension and persisted relay sessions.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession,
  ): Promise<Session | null> {
    try {
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      const transportFromSession = persisted.metadata?.transport;

      if (this.target === 'local' || transportFromSession === 'injected') {
        // Local mode or session was created via extension — verify extension
        const availability =
          await (await getConsoleWallet()).checkExtensionAvailability();
        if (availability.status !== 'installed') return null;
      }

      // isConnected() checks both extension and relay session state
      const connectStatus = await (await getConsoleWallet()).isConnected();
      if (!connectStatus.isConnected) {
        ctx.logger.debug(
          'Console Wallet not connected, cannot restore',
          { target: this.target, transportFromSession },
        );
        return null;
      }

      // Restore active transport from session metadata
      if (transportFromSession === 'injected' || transportFromSession === 'remote') {
        this.activeTransport = transportFromSession;
      } else if (this.target === 'local') {
        this.activeTransport = 'injected';
      } else if (this.target === 'remote') {
        this.activeTransport = 'remote';
      } else {
        // Combined: infer from extension availability
        try {
          const availability =
            await (await getConsoleWallet()).checkExtensionAvailability();
          this.activeTransport =
            availability.status === 'installed' ? 'injected' : 'remote';
        } catch {
          this.activeTransport = 'remote';
        }
      }

      ctx.logger.debug('Restored Console Wallet session', {
        sessionId: persisted.sessionId,
        partyId: persisted.partyId,
        transport: this.activeTransport,
      });

      return { ...persisted, walletId: this.walletId };
    } catch (err) {
      ctx.logger.warn('Failed to restore Console Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message. Encodes the message as base64 for the SDK.
   *
   * LIVE-VERIFIED against the real Console extension (provider lpnf…): Console
   * signs a base64-encoded message; the prior `{ message: { hex } }` shape was
   * superseded. The dapp-sdk's `SignMessageRequest.message` is `{ hex } | { base64 }`
   * (dapp-sdk types/signed.type.d.ts), so we pass the SDK's base64 form
   * `{ message: { base64 } }` (no metaData, matching the validated call).
   *
   * Works identically for both local and remote transports — the SDK routes
   * the request to the correct transport internally.
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Signing message with Console Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
        transport,
      });

      // Base64-encode the message and send the SDK's base64 form
      // `{ message: { base64 } }` with NO metaData (the live-validated shape).
      const result: unknown = await (await getConsoleWallet()).signMessage({
        message: { base64: toBase64Message(params.message) },
      });

      // Response: the dapp-sdk wrapper returns the signature as a string
      // (SignedMessageResponse = string | undefined). Read defensively (mirrors
      // the generic adapter) so a `{ signature }` shape also normalizes.
      const sig =
        typeof result === 'string'
          ? result
          : (result as { signature?: unknown } | null)?.signature ?? '';

      return {
        signature: toSignature(String(sig)),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Sign a transaction. Uses submitCommands without waitForFinalization.
   */
  async signTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Signing transaction with Console Wallet', {
        sessionId: session.sessionId,
        transport,
      });

      // submitCommands is the SDK's tx signing method
      const result = await (await getConsoleWallet()).submitCommands(
        params.tx as Parameters<ConsoleWalletApi['submitCommands']>[0],
      );

      const txHash = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      return {
        signedTx: result,
        transactionHash: toTransactionHash(txHash),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signTransaction',
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Submit a transaction. Uses submitCommands with waitForFinalization.
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Submitting transaction with Console Wallet', {
        sessionId: session.sessionId,
        transport,
      });

      const txData = params.signedTx as Parameters<ConsoleWalletApi['submitCommands']>[0];
      const result = await (await getConsoleWallet()).submitCommands({
        ...txData,
        waitForFinalization: 5000,
      });

      const signature =
        result && typeof result === 'object' && 'signature' in result
          ? String(result.signature)
          : `tx_${Date.now()}`;

      return {
        transactionHash: toTransactionHash(signature),
        submittedAt: Date.now(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Proxy a Ledger API request through the Console Wallet.
   *
   * Console Wallet is CIP-0103 compliant and exposes ledgerApi via its SDK.
   * Works through both local and remote transports.
   */
  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      // Console is a CIP-0103 RPC wallet — canonical dApp API shape: lower-case
      // verb + an OBJECT body. The SDK boundary accepts both cases + a string
      // body, so normalize here.
      const requestMethod = normalizeLedgerMethodLower(params.requestMethod);
      const body = ledgerApiBodyToObject(params.body);

      ctx.logger.debug('Proxying ledger API request via Console Wallet', {
        sessionId: session.sessionId,
        requestMethod,
        resource: params.resource,
        transport,
      });

      // The Console Wallet SDK may expose ledgerApi directly or via a generic
      // request() method (CIP-0103 standard).
      const wallet = (await getConsoleWallet()) as unknown as {
        ledgerApi?: (p: {
          requestMethod: string;
          resource: string;
          body?: string | Record<string, unknown>;
        }) => Promise<unknown>;
        request?: (args: {
          method: string;
          params?: unknown;
        }) => Promise<unknown>;
      };

      if (typeof wallet.ledgerApi === 'function') {
        const result = await wallet.ledgerApi({
          requestMethod,
          resource: params.resource,
          body,
        });
        const response = result as { response?: string } | string;
        return {
          response:
            typeof response === 'string'
              ? response
              : (response?.response ?? JSON.stringify(response)),
        };
      }

      if (typeof wallet.request === 'function') {
        const result = await wallet.request({
          method: 'ledgerApi',
          params: {
            requestMethod,
            resource: params.resource,
            body,
          },
        });
        const response = result as { response?: string } | string;
        return {
          response:
            typeof response === 'string'
              ? response
              : (response?.response ?? JSON.stringify(response)),
        };
      }

      throw new CapabilityNotSupportedError(
        this.walletId,
        'ledgerApi — update Console Wallet extension to a version that supports CIP-0103 ledgerApi',
      );
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Request a typed transfer.
   *
   * Maps the intent onto Console's `submitCommands` (the SDK's sign-and-send),
   * which is itself a typed transfer: the WALLET builds the command, shows the
   * user the recipient, token, amount and memo, takes their approval, signs and
   * submits. PartyLayer never builds a command and never sees a prepared
   * transaction.
   *
   * The update id comes from the `txChanged` stream, not from the call's return
   * value — `SignSendResponse` carries only `{ status, signature }`. See
   * {@link ConsoleTransferWaiter} for how the two are correlated.
   *
   * Two intent fields Console cannot carry are refused rather than dropped:
   * an absent `executeBefore` (its `expireDate` is required and PartyLayer will
   * not invent a deadline the user would then be shown) and a `meta` map with
   * anything other than a single `memo` key (its `memo` is one string). Silently
   * discarding either would make the confirmation the user approves untrue.
   */
  async requestTransfer(
    ctx: AdapterContext,
    session: Session,
    intent: TransferIntent,
  ): Promise<TransferResult> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);
    // Defensive: the client narrows before calling, but an adapter can be driven
    // directly, and the allowlist is the guarantee that no caller-supplied
    // option reaches the wallet.
    const safe = toTransferIntent(intent);

    if (!safe.executeBefore) {
      throw new CapabilityNotSupportedError(
        this.walletId,
        'transfer — Console Wallet requires an explicit deadline; set intent.executeBefore (ISO 8601)',
      );
    }

    const memo = this.consoleMemoFor(safe);

    try {
      ctx.logger.debug('Requesting transfer via Console Wallet', {
        sessionId: session.sessionId,
        transport,
      });

      const waiter = new ConsoleTransferWaiter();
      const detach = this.attachTransferWaiter(waiter);
      const terminal = waiter.promise();
      // Buffer from before the call: `signed` can arrive before the call resolves.
      const timer = setTimeout(
        () =>
          waiter.reject(
            new Error(
              `Console Wallet did not report an executed transfer within ${TRANSFER_EXECUTION_TIMEOUT_MS}ms. `
              + 'The transfer may still be in flight; check the wallet before retrying.',
            ),
          ),
        TRANSFER_EXECUTION_TIMEOUT_MS,
      );

      try {
        const response = await (await getConsoleWallet()).submitCommands({
          // The acting party is the session's, never the caller's.
          from: String(session.partyId),
          to: safe.receiver,
          token: safe.instrumentId.id,
          amount: safe.amount,
          expireDate: safe.executeBefore,
          ...(memo === undefined ? {} : { memo }),
        });

        if (!response || response.status !== true) {
          throw new Error('Console Wallet did not approve the transfer.');
        }

        waiter.correlate(response.signature);
        const executed = await terminal;

        const updateId = executed.payload?.updateId;
        if (!updateId) {
          // Never substitute a command id, a signature, or a generated string.
          throw new Error(
            'Console Wallet reported the transfer executed but supplied no update id.',
          );
        }

        return {
          updateId,
          commandId: executed.commandId,
          completionOffset: executed.payload?.completionOffset,
          partyId: session.partyId,
        };
      } finally {
        clearTimeout(timer);
        detach();
      }
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'requestTransfer',
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Console's `memo` is a single string while a `TransferIntent.meta` is a map.
   * Accept an absent/empty map, or exactly `{ memo }`; refuse anything else so
   * metadata is never silently dropped from what the user approves.
   */
  private consoleMemoFor(intent: TransferIntent): string | undefined {
    const meta = intent.meta;
    if (!meta) return undefined;
    const keys = Object.keys(meta);
    if (keys.length === 0) return undefined;
    if (keys.length === 1 && keys[0] === 'memo') return meta.memo;
    throw new CapabilityNotSupportedError(
      this.walletId,
      `transfer — Console Wallet carries a single "memo" string, not a metadata map; `
      + `intent.meta has [${keys.join(', ')}]`,
    );
  }

  /**
   * Register a waiter on the shared `txChanged` stream, returning a detach fn.
   *
   * The stream is subscribed ONCE per adapter. The SDK's `onTxStatusChanged`
   * adds a `window` message listener and returns no unsubscribe, so subscribing
   * per transfer would leak a listener on every call.
   */
  private attachTransferWaiter(waiter: ConsoleTransferWaiter): () => void {
    this.transferWaiters.add(waiter);
    if (!this.txStreamAttached) {
      this.txStreamAttached = true;
      void getConsoleWallet().then((cw) =>
        cw.onTxStatusChanged((txEvent) => {
          for (const w of this.transferWaiters) w.accept(txEvent as unknown as ConsoleTxEvent);
        }),
      );
    }
    return () => this.transferWaiters.delete(waiter);
  }

  /**
   * Subscribe to wallet events.
   *
   * The SDK's event callbacks work for both local and remote transports.
   */
  on(
    event: 'connect' | 'disconnect' | 'sessionExpired' | 'txStatus' | 'error',
    handler: (payload: unknown) => void,
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    switch (event) {
      case 'connect':
      case 'disconnect':
        // Defer the subscription via the cached SDK import (browser-only). The
        // unsubscribe stays a synchronous no-op — signature unchanged.
        void getConsoleWallet().then((cw) =>
          cw.onConnectionStatusChanged((status) => {
            handler(status);
          }),
        );
        return () => {};

      case 'txStatus':
        void getConsoleWallet().then((cw) =>
          cw.onTxStatusChanged((txEvent) => {
            handler(txEvent);
          }),
        );
        return () => {};

      default:
        return () => {};
    }
  }

  /**
   * Check extension availability via the SDK's postMessage probe.
   */
  private async detectExtension(): Promise<AdapterDetectResult> {
    try {
      const availability =
        await (await getConsoleWallet()).checkExtensionAvailability();

      if (availability.status === 'installed') {
        return {
          installed: true,
          reason: `Console Wallet detected${availability.currentVersion ? ` (v${availability.currentVersion})` : ''}`,
        };
      }

      return {
        installed: false,
        reason:
          'Console Wallet extension not detected. Install from https://consolewallet.io',
      };
    } catch {
      // checkExtensionAvailability may timeout if extension is not present
      return {
        installed: false,
        reason:
          'Console Wallet extension not responding. Ensure it is installed and enabled.',
      };
    }
  }
}
