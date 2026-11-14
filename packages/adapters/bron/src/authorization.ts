import { UserRejectedError } from '@partylayer/core';
import type { BronAuthClient } from './auth';

const CALLBACK = 'partylayer:bron:authorization-callback';

/**
 * Call from the application's registered redirect page. The popup relays only
 * to its own origin; the opener verifies the source, path, state and PKCE.
 * This helper does not register a Bron OAuth client or define vendor endpoints.
 */
export function completeBronAuthorization(redirectUri: string): void {
  if (typeof window === 'undefined' || !window.opener) throw new Error('Open this OAuth callback from the connecting application');
  const expected = new URL(redirectUri);
  if (window.location.origin !== expected.origin || window.location.pathname !== expected.pathname) throw new Error('Unexpected OAuth redirect page');
  const callbackUrl = window.location.href;
  window.opener.postMessage({ type: CALLBACK, callbackUrl }, expected.origin);
  // Clear authorization codes from this page's address/history after relaying.
  window.history.replaceState(null, '', expected.pathname);
  window.close();
}

/** Internal bounded popup bridge for the legacy, explicitly configured OAuth integration. */
export async function authorizeBronPopup(auth: BronAuthClient, redirectUri: string, timeoutMs: number): Promise<void> {
  if (typeof window === 'undefined') throw new Error('OAuth flow requires a browser environment');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error('Invalid OAuth timeout');
  const expected = new URL(redirectUri);
  if (expected.origin !== window.location.origin) throw new Error('Register a same-origin OAuth callback page');
  const url = await auth.startAuth();
  const popup = window.open(url, 'partylayer-bron-authorization', 'width=500,height=650');
  if (!popup) { auth.cancelAuthorization(); throw new Error('Allow the wallet authorization popup and try again'); }
  return new Promise<void>((resolve, reject) => {
    const signal = auth.getAuthorizationSignal();
    let callbackReceived = false;
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearInterval(closed);
      window.removeEventListener('message', receive);
      signal.removeEventListener('abort', cancel);
      if (error) auth.cancelAuthorization();
      try { popup.close(); } catch { /* Window closure does not determine the auth result. */ }
      if (error) reject(error); else resolve();
    };
    const receive = (event: MessageEvent) => {
      if (finished || callbackReceived || event.source !== popup || event.origin !== expected.origin ||
        !event.data || event.data.type !== CALLBACK || typeof event.data.callbackUrl !== 'string') return;
      callbackReceived = true;
      void auth.finishAuth(event.data.callbackUrl).then(() => finish(), error => finish(error));
    };
    const cancel = () => finish(new Error('Wallet authorization cancelled'));
    const timer = setTimeout(() => finish(new Error('Wallet authorization timed out')), timeoutMs);
    const closed = setInterval(() => {
      if (!callbackReceived && popup.closed) finish(new UserRejectedError('Wallet authorization was closed'));
    }, 250);
    window.addEventListener('message', receive);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
