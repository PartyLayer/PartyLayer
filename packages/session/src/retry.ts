/**
 * Reconnect retry policy + backoff math.
 *
 * Pure + deterministic (jitter is opt-in and injectable) so the backoff SCHEDULE
 * can be asserted at exact fake-timer offsets in tests.
 */

/** Exponential-backoff reconnect policy. */
export interface RetryPolicy {
  /** Delay before the FIRST retry (attempt 1), in ms. */
  baseDelayMs: number;
  /** Multiplier applied per attempt (`base * factor^(attempt-1)`). */
  factor: number;
  /** Upper bound on any single delay, in ms. */
  maxDelayMs: number;
  /** Max reconnect attempts before giving up. */
  maxAttempts: number;
  /** When true, randomize each delay within [50%, 100%] of the computed value. */
  jitter?: boolean;
}

/** Sane defaults: 0.5s → 1s → 2s → 4s → 8s, capped at 30s, 5 attempts, no jitter. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 500,
  factor: 2,
  maxDelayMs: 30_000,
  maxAttempts: 5,
  jitter: false,
};

/**
 * Compute the delay (ms) before a 1-based `attempt`. Exponential, capped at
 * `maxDelayMs`. With `jitter`, scales by a `rand()` value in [0,1) into the
 * [50%,100%] band (`rand` injectable for determinism; defaults to Math.random).
 */
export function computeBackoffDelay(
  policy: RetryPolicy,
  attempt: number,
  rand: () => number = Math.random,
): number {
  const raw = policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  let delay = Math.min(raw, policy.maxDelayMs);
  if (policy.jitter) delay = delay * (0.5 + rand() * 0.5);
  return Math.round(delay);
}
