/**
 * Error taxonomy for PartyLayer SDK
 * 
 * All errors extend PartyLayerError with stable error codes.
 * Error codes are string literals for telemetry and UI message mapping.
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

/**
 * Error code union - stable string literals for telemetry and UI
 */
export type ErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'ADAPTER_NOT_REGISTERED'
  | 'WALLET_NOT_INSTALLED'
  | 'USER_REJECTED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'SESSION_EXPIRED'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'TRANSPORT_ERROR'
  | 'REGISTRY_FETCH_FAILED'
  | 'REGISTRY_VERIFICATION_FAILED'
  | 'REGISTRY_SIGNATURE_MISSING'
  | 'REGISTRY_SCHEMA_INVALID'
  | 'INTERNAL_ERROR'
  | 'NETWORK_MISMATCH'
  | 'TIMEOUT'
  | 'INSUFFICIENT_TRAFFIC'
  | 'SYNCHRONIZER_ERROR'
  /**
   * The WALLET refused the request for a reason of its own — not the user
   * declining a prompt. Nightly refusing because the tab is unfocused
   * ("Connect request rejected - tab is not active") is the canonical case:
   * no prompt was ever shown, so reporting USER_REJECTED told the dApp
   * something untrue. The wallet's own words are preserved in
   * `details.originalMessage` and repeated in `message`.
   */
  | 'WALLET_REFUSED';

/**
 * Error mapping context
 */
export interface ErrorMappingContext {
  /** Wallet ID (if applicable) */
  walletId?: string;
  /** Operation phase */
  phase: 'connect' | 'restore' | 'signMessage' | 'signTransaction' | 'submitTransaction' | 'ledgerApi' | 'requestTransfer';
  /** Transport type */
  transport?: 'injected' | 'popup' | 'deeplink' | 'remote';
  /** Timeout in milliseconds (for timeout errors) */
  timeoutMs?: number;
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Base error class for all PartyLayer errors
 */
export class PartyLayerError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: unknown;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    options?: {
      cause?: unknown;
      details?: Record<string, unknown>;
      isOperational?: boolean;
    }
  ) {
    super(message);
    this.name = 'PartyLayerError';
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PartyLayerError);
    }
  }

  /**
   * Serialize error to JSON for telemetry/logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      isOperational: this.isOperational,
      details: this.details,
      cause: this.cause instanceof Error
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : this.cause,
    };
  }
}

/**
 * Wallet not found error
 */
export class WalletNotFoundError extends PartyLayerError {
  constructor(walletId: string) {
    super(`Wallet "${walletId}" not found`, 'WALLET_NOT_FOUND', {
      details: { walletId },
    });
    this.name = 'WalletNotFoundError';
  }
}

/**
 * A popup/remote (`transport: 'discovery-adapter'`) wallet was requested by
 * `walletId`, but its provider adapter — which the app supplies, not the SDK —
 * was never registered. Distinct from {@link WalletNotFoundError}: the wallet IS
 * a known registry entry, it's just not wired up. The message is actionable
 * (how to register it) and is built generically from the registry entry, so it
 * works for any discovery-adapter wallet. Higher-level UIs (e.g. PartyLayerKit)
 * can `catch (e instanceof AdapterNotRegisteredError)` to surface wiring help.
 */
export class AdapterNotRegisteredError extends PartyLayerError {
  constructor(
    walletId: string,
    info: { name?: string; providerId?: string; adapterPackage?: string } = {}
  ) {
    const providerId = info.providerId ?? walletId;
    const label = info.name ? `"${info.name}" (${walletId})` : `"${walletId}"`;
    const pkg = info.adapterPackage ? ` (provider from ${info.adapterPackage})` : '';
    super(
      `Wallet ${label} is a popup/remote (discovery-adapter) wallet: its provider is ` +
        `supplied by your app, not bundled${pkg}. Register it with createPartyLayer: ` +
        `adapters: [{ providerId: '${providerId}', create: (host) => /* new provider adapter */ }]. ` +
        `See https://partylayer.xyz/docs/wallets`,
      'ADAPTER_NOT_REGISTERED',
      { details: { walletId, providerId } }
    );
    this.name = 'AdapterNotRegisteredError';
  }
}

/**
 * Wallet not installed error
 */
export class WalletNotInstalledError extends PartyLayerError {
  constructor(walletId: string, reason?: string) {
    super(
      `Wallet "${walletId}" is not installed${reason ? `: ${reason}` : ''}`,
      'WALLET_NOT_INSTALLED',
      {
        details: { walletId, reason },
      }
    );
    this.name = 'WalletNotInstalledError';
  }
}

/**
 * User rejected error
 */
export class UserRejectedError extends PartyLayerError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(`User rejected ${operation}`, 'USER_REJECTED', {
      details: { operation, ...details },
    });
    this.name = 'UserRejectedError';
  }
}

/**
 * The wallet refused the request for its own reason.
 *
 * Distinct from {@link UserRejectedError}: nobody was asked. Use this whenever
 * the wallet declined without a user-facing prompt — unfocused tab, locked
 * vault, unsupported network, origin not allowlisted. The wallet's message is
 * carried through verbatim so a dApp can show it instead of guessing.
 */
export class WalletRefusedError extends PartyLayerError {
  constructor(
    operation: string,
    details: { originalMessage: string } & Record<string, unknown>
  ) {
    super(`Wallet refused ${operation}: ${details.originalMessage}`, 'WALLET_REFUSED', {
      details: { operation, ...details },
    });
    this.name = 'WalletRefusedError';
  }
}

/**
 * Origin not allowed error
 */
export class OriginNotAllowedError extends PartyLayerError {
  constructor(origin: string, allowedOrigins?: string[]) {
    super(
      `Origin "${origin}" is not allowed`,
      'ORIGIN_NOT_ALLOWED',
      {
        details: { origin, allowedOrigins },
      }
    );
    this.name = 'OriginNotAllowedError';
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends PartyLayerError {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" has expired`, 'SESSION_EXPIRED', {
      details: { sessionId },
    });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Network mismatch error — the connected wallet's effective network differs
 * from the dApp's configured network. Thrown to block wrong-network connects
 * (policy 'strict') and wrong-network transactions (policy 'guard' | 'strict').
 */
export class NetworkMismatchError extends PartyLayerError {
  /** The dApp's configured (expected) network, CAIP-2 normalized. */
  public readonly expected: string;
  /** The wallet's reported (actual) network, CAIP-2 normalized. */
  public readonly actual: string;

  constructor(expected: string, actual: string) {
    super(
      `Wallet is on network "${actual}" but this app requires "${expected}". Switch your wallet's network, then reconnect.`,
      'NETWORK_MISMATCH',
      { details: { expected, actual } }
    );
    this.name = 'NetworkMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Capability not supported error
 */
export class CapabilityNotSupportedError extends PartyLayerError {
  constructor(walletId: string, capability: string) {
    super(
      `Wallet "${walletId}" does not support capability "${capability}"`,
      'CAPABILITY_NOT_SUPPORTED',
      {
        details: { walletId, capability },
      }
    );
    this.name = 'CapabilityNotSupportedError';
  }
}

/**
 * Transport error
 */
export class TransportError extends PartyLayerError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super(message, 'TRANSPORT_ERROR', {
      cause,
      details,
    });
    this.name = 'TransportError';
  }
}

/**
 * Registry fetch failed error
 */
export class RegistryFetchFailedError extends PartyLayerError {
  constructor(url: string, cause?: unknown) {
    super(`Failed to fetch registry from "${url}"`, 'REGISTRY_FETCH_FAILED', {
      cause,
      details: { url },
    });
    this.name = 'RegistryFetchFailedError';
  }
}

/**
 * Registry verification failed error
 */
export class RegistryVerificationFailedError extends PartyLayerError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Registry verification failed: ${reason}`, 'REGISTRY_VERIFICATION_FAILED', {
      details: { reason, ...details },
    });
    this.name = 'RegistryVerificationFailedError';
  }
}

/**
 * The registry signature a verifying client requires was definitively absent
 * (the endpoint answered, and said it is not there).
 *
 * Deliberately NOT the same error as a failed verification. A missing signature
 * is a deployment state: signing has not been published for this channel yet,
 * or was not published for this release. A failed verification means bytes were
 * served that do not match the key, which is the case signature checking exists
 * to catch. Collapsing the two would make an outage indistinguishable from an
 * attack, and the reflex when that fires in production is to switch verification
 * off, which is how the control dies.
 */
export class RegistrySignatureMissingError extends PartyLayerError {
  constructor(url: string, details?: Record<string, unknown>) {
    super(`No registry signature at "${url}"`, 'REGISTRY_SIGNATURE_MISSING', {
      details: { url, ...details },
    });
    this.name = 'RegistrySignatureMissingError';
  }
}

/**
 * Registry schema invalid error
 */
export class RegistrySchemaInvalidError extends PartyLayerError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Registry schema invalid: ${reason}`, 'REGISTRY_SCHEMA_INVALID', {
      details: { reason, ...details },
    });
    this.name = 'RegistrySchemaInvalidError';
  }
}

/**
 * Internal error (non-operational)
 */
export class InternalError extends PartyLayerError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', {
      cause,
      details,
      isOperational: false,
    });
    this.name = 'InternalError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends PartyLayerError {
  /**
   * `timeoutMs` is OPTIONAL on purpose. Previously an unknown deadline was
   * coerced to `0`, so the message read "timed out after 0ms" — a number that
   * described nothing. When the deadline is genuinely unknown we now say so
   * rather than inventing a figure.
   */
  constructor(operation: string, timeoutMs?: number) {
    super(
      typeof timeoutMs === 'number'
        ? `Operation "${operation}" timed out after ${timeoutMs}ms`
        : `Operation "${operation}" timed out`,
      'TIMEOUT',
      {
        details: { operation, ...(typeof timeoutMs === 'number' ? { timeoutMs } : {}) },
      }
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Insufficient traffic error: the submission was rejected because the member's
 * traffic allowance (base rate plus any purchased extra) is exhausted. Canton's
 * sequencer surfaces this as a submission rejection; the operator or user tops up
 * traffic to proceed.
 */
export class InsufficientTrafficError extends PartyLayerError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_TRAFFIC', {
      cause,
      details,
    });
    this.name = 'InsufficientTrafficError';
  }
}

/**
 * Synchronizer error: a synchronizer level condition the kit surfaces directly,
 * for example a submission blocked because its disclosed contracts do not all
 * share one synchronizer, or a synchronizer the app routes to being unavailable.
 *
 * This code is additive and kit level: CIP-0103 defines no dedicated synchronizer
 * code, so it has no wire mapping on the Provider surface and never modifies
 * CIP-0103 semantics. Canton routing failures observed through a dApp's own Model 2
 * ledger and registry calls (for example NO_COMMON_DOMAIN) stay the dApp's to
 * classify and are not raised here. See docs/errors.md.
 */
export class SynchronizerError extends PartyLayerError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super(message, 'SYNCHRONIZER_ERROR', {
      cause,
      details,
    });
    this.name = 'SynchronizerError';
  }
}

/**
 * Map unknown errors to PartyLayerError
 *
 * This is the single error mapping strategy used by all adapters.
 * It normalizes errors from various sources (wallet SDKs, network, etc.)
 * into typed PartyLayerError instances.
 */
export function mapUnknownErrorToPartyLayerError(
  err: unknown,
  context: ErrorMappingContext
): PartyLayerError {
  // Already a PartyLayerError
  if (err instanceof PartyLayerError) {
    return err;
  }

  // Standard Error
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Traffic exhaustion patterns. Checked BEFORE the rejection branch because
    // Canton's real rejection string ("Submission was rejected because not traffic
    // is available: AboveTrafficLimit") contains "rejected". Matches only the
    // strings Canton actually produces.
    if (
      message.includes('insufficient traffic') ||
      message.includes('abovetrafficlimit')
    ) {
      return new InsufficientTrafficError(err.message, err, {
        walletId: context.walletId,
        phase: context.phase,
        transport: context.transport,
      });
    }

    // ── Refusals ────────────────────────────────────────────────────────
    // STRUCTURED SIGNALS FIRST. A bare substring scan for "rejected" used to
    // collapse every wallet-side refusal into USER_REJECTED — Nightly's
    // "Connect request rejected - tab is not active" reported a cancellation
    // the user never made. Only an explicit signal counts as the user saying no.
    // `err.name` and EIP-1193 4001 are the only unambiguous "the user said no"
    // signals. Failing those, the phrasing must actually NAME the user — either
    // side of the verb — so "rejected by the wallet because X" does not match.
    const isUserRejection =
      err.name === 'UserRejectedError' ||
      (err as { code?: unknown }).code === 4001 ||
      /\buser\b.{0,24}(reject|den|declin|cancel|abort)|(reject|den|declin|cancel|abort)\w*.{0,24}\bby (?:the )?user\b/.test(
        message,
      );

    const detail = {
      walletId: context.walletId,
      transport: context.transport,
      originalMessage: err.message,
    };

    if (isUserRejection) return new UserRejectedError(context.phase, detail);

    // A refusal that is NOT the user's: keep the wallet's own words.
    if (/reject|denied|declin|refus/.test(message)) {
      return new WalletRefusedError(context.phase, detail);
    }

    // Timeout patterns
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      err.name === 'TimeoutError'
    ) {
      // THE NUMBER IN THE MESSAGE WINS. The timeout that actually fired put its
      // own deadline in the string; `context.timeoutMs` is whatever the calling
      // layer happened to hold and was previously allowed to overwrite it — that
      // is how a 120 000 ms race came to be reported as "30000ms". Context is a
      // FALLBACK now, used only when the message carries no figure, and an
      // unknown deadline stays unknown instead of becoming 0.
      const msMatch = err.message.match(/(\d+)\s*ms\b/i);
      const secMatch = err.message.match(/(\d+)\s*(?:s\b|sec|second)/i);
      const fromMessage = msMatch
        ? parseInt(msMatch[1], 10)
        : secMatch
          ? parseInt(secMatch[1], 10) * 1000
          : undefined;

      const timeoutMs =
        fromMessage ??
        (typeof context.timeoutMs === 'number' && context.timeoutMs > 0
          ? context.timeoutMs
          : undefined);

      return new TimeoutError(context.phase, timeoutMs);
    }

    // Network/transport errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      err.name === 'NetworkError' ||
      err.name === 'TypeError'
    ) {
      return new TransportError(err.message, err, {
        walletId: context.walletId,
        phase: context.phase,
        transport: context.transport,
      });
    }

    // Generic transport error
    return new TransportError(err.message, err, {
      walletId: context.walletId,
      phase: context.phase,
      transport: context.transport,
      originalError: err.name,
    });
  }

  // String errors
  if (typeof err === 'string') {
    return new TransportError(err, undefined, {
      walletId: context.walletId,
      phase: context.phase,
      transport: context.transport,
    });
  }

  // Unknown error type
  return new InternalError(
    `Unknown error in ${context.phase}`,
    err,
    {
      walletId: context.walletId,
      transport: context.transport,
      errorType: typeof err,
    }
  );
}
