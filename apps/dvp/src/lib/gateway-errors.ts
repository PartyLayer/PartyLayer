/**
 * One seam for turning gateway failures into safe, friendly text. Both UI sinks
 * (ErrorState for reads, TransactionToast for mutations) render an Error's message,
 * so mapping here at the fetch layer covers both without touching either sink.
 *
 * The raw body goes to the console only. It can carry a Canton interpretation
 * error, a traceId or correlationId, a sequencer or participant identity, party or
 * contract ids, or truncated JSON, none of which should ever reach the screen.
 */

/** DevNet sequencer backpressure (409) and overload (503): transient, worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 409 || status === 503;
}

/**
 * A gateway error whose `message` is always safe to render. `retryable` marks the
 * DevNet-busy conditions the retry layer handles; `status` is kept for logging and
 * tests, never for display.
 */
export class GatewayError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, userMessage: string, retryable: boolean) {
    super(userMessage);
    this.name = 'GatewayError';
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Map an HTTP status and raw body to a friendly, leak-free GatewayError, logging
 * the raw detail to the console. The 409 and 503 message is the FINAL wording
 * shown after retries are exhausted; the transient "retrying" wording lives in the
 * retry layer's loading panel.
 */
export function mapGatewayError(status: number, rawBody: unknown): GatewayError {
  console.error('[gateway] request failed', { status, body: rawBody });
  const retryable = isRetryableStatus(status);
  const message = retryable
    ? 'DevNet is under heavy load. Please try again in a minute.'
    : 'Something went wrong talking to the network. Please try again.';
  return new GatewayError(status, message, retryable);
}
