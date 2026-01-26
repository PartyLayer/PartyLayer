/**
 * Error taxonomy for CantonConnect SDK
 * 
 * All errors extend CantonConnectError with stable error codes.
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
  | 'WALLET_NOT_INSTALLED'
  | 'USER_REJECTED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'SESSION_EXPIRED'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'TRANSPORT_ERROR'
  | 'REGISTRY_FETCH_FAILED'
  | 'REGISTRY_VERIFICATION_FAILED'
  | 'REGISTRY_SCHEMA_INVALID'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT';

/**
 * Error mapping context
 */
export interface ErrorMappingContext {
  /** Wallet ID (if applicable) */
  walletId?: string;
  /** Operation phase */
  phase: 'connect' | 'restore' | 'signMessage' | 'signTransaction' | 'submitTransaction';
  /** Transport type */
  transport?: 'injected' | 'popup' | 'deeplink' | 'remote';
  /** Timeout in milliseconds (for timeout errors) */
  timeoutMs?: number;
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Base error class for all CantonConnect errors
 */
export class CantonConnectError extends Error {
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
    this.name = 'CantonConnectError';
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CantonConnectError);
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
export class WalletNotFoundError extends CantonConnectError {
  constructor(walletId: string) {
    super(`Wallet "${walletId}" not found`, 'WALLET_NOT_FOUND', {
      details: { walletId },
    });
    this.name = 'WalletNotFoundError';
  }
}

/**
 * Wallet not installed error
 */
export class WalletNotInstalledError extends CantonConnectError {
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
export class UserRejectedError extends CantonConnectError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(`User rejected ${operation}`, 'USER_REJECTED', {
      details: { operation, ...details },
    });
    this.name = 'UserRejectedError';
  }
}

/**
 * Origin not allowed error
 */
export class OriginNotAllowedError extends CantonConnectError {
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
export class SessionExpiredError extends CantonConnectError {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" has expired`, 'SESSION_EXPIRED', {
      details: { sessionId },
    });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Capability not supported error
 */
export class CapabilityNotSupportedError extends CantonConnectError {
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
export class TransportError extends CantonConnectError {
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
export class RegistryFetchFailedError extends CantonConnectError {
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
export class RegistryVerificationFailedError extends CantonConnectError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Registry verification failed: ${reason}`, 'REGISTRY_VERIFICATION_FAILED', {
      details: { reason, ...details },
    });
    this.name = 'RegistryVerificationFailedError';
  }
}

/**
 * Registry schema invalid error
 */
export class RegistrySchemaInvalidError extends CantonConnectError {
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
export class InternalError extends CantonConnectError {
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
export class TimeoutError extends CantonConnectError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation "${operation}" timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      {
        details: { operation, timeoutMs },
      }
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Map unknown errors to CantonConnectError
 * 
 * This is the single error mapping strategy used by all adapters.
 * It normalizes errors from various sources (wallet SDKs, network, etc.)
 * into typed CantonConnectError instances.
 */
export function mapUnknownErrorToCantonConnectError(
  err: unknown,
  context: ErrorMappingContext
): CantonConnectError {
  // Already a CantonConnectError
  if (err instanceof CantonConnectError) {
    return err;
  }

  // Standard Error
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // User rejection patterns
    if (
      message.includes('rejected') ||
      message.includes('denied') ||
      message.includes('cancelled') ||
      message.includes('canceled') ||
      err.name === 'UserRejectedError'
    ) {
      return new UserRejectedError(context.phase, {
        walletId: context.walletId,
        transport: context.transport,
        originalMessage: err.message,
      });
    }

    // Timeout patterns
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      err.name === 'TimeoutError'
    ) {
      // Try to get timeout from context, or extract from error message, or default to 0
      let timeoutMs = context.timeoutMs ?? 0;
      if (timeoutMs === 0) {
        // Try to extract from message like "timed out after 30000ms" or "timeout after 30s"
        const msMatch = err.message.match(/(\d+)\s*ms/i);
        const secMatch = err.message.match(/(\d+)\s*(?:sec|second)/i);
        if (msMatch) {
          timeoutMs = parseInt(msMatch[1], 10);
        } else if (secMatch) {
          timeoutMs = parseInt(secMatch[1], 10) * 1000;
        }
      }
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
