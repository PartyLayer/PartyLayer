/**
 * App-level banner shown while a submit is being retried after a DevNet-busy
 * response (409 or 503). One banner covers every submit, so no mutation needs its
 * own retry state. Subscribes to the retry store via useSyncExternalStore.
 */
import { useSyncExternalStore } from 'react';
import { subscribeRetry, getRetryStatus } from '../lib/retry';

export function RetryBanner() {
  const status = useSyncExternalStore(subscribeRetry, getRetryStatus, getRetryStatus);
  if (!status.active) return null;
  return (
    <div className="retry-banner" role="status" aria-live="polite">
      The Canton DevNet is busy right now. Retrying automatically. (Retrying {status.attempt} of{' '}
      {status.max})
    </div>
  );
}
