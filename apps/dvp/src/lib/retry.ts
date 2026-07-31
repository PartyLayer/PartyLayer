/**
 * Automatic retry for submits on DevNet-busy conditions (409 backpressure, 503
 * overload), with exponential backoff plus jitter. Reads are not retried; wrap only
 * submit calls. Progress is published to a tiny store so one app-level banner can
 * show "Retrying (N of 3)" without threading state through every mutation.
 */
import { GatewayError } from './gateway-errors';

const MAX_ATTEMPTS = 3;
const BASE_MS = 2000;
const CAP_MS = 10000;

export interface RetryStatus {
  active: boolean;
  attempt: number;
  max: number;
}

let status: RetryStatus = { active: false, attempt: 0, max: MAX_ATTEMPTS };
const listeners = new Set<() => void>();

export function subscribeRetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getRetryStatus(): RetryStatus {
  return status;
}
function setStatus(next: RetryStatus): void {
  status = next;
  for (const l of listeners) l();
}

/**
 * Exponential backoff (base 2s, cap 10s) with equal jitter: the wait for the Nth
 * retry is a random value in [ceiling/2, ceiling] where ceiling = min(cap, base *
 * 2^(N-1)). Equal jitter keeps waits meaningful (never near zero) while still
 * spreading load.
 */
function backoffMs(attempt: number): number {
  const ceiling = Math.min(CAP_MS, BASE_MS * 2 ** (attempt - 1));
  return Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    }
  });
}

/**
 * Run a submit with up to 3 attempts, retrying only on a retryable GatewayError
 * (409/503). Publishes "retrying" status before each wait and clears it when done,
 * so the outcome (success or the mapped final error) is what reaches the caller.
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await fn(signal);
      if (status.active) setStatus({ active: false, attempt: 0, max: MAX_ATTEMPTS });
      return result;
    } catch (err) {
      const retryable = err instanceof GatewayError && err.retryable;
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        if (status.active) setStatus({ active: false, attempt: 0, max: MAX_ATTEMPTS });
        throw err;
      }
      // About to make attempt number (attempt + 1) of MAX_ATTEMPTS.
      setStatus({ active: true, attempt: attempt + 1, max: MAX_ATTEMPTS });
      await sleep(backoffMs(attempt), signal);
    }
  }
}
