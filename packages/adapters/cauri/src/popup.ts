/**
 * Popup helpers for the Cauri wallet approval flow.
 *
 * `openPlaceholderPopup` opens `about:blank` synchronously inside a user
 * gesture (browsers demote a later `window.open` to a background tab if the
 * gesture is consumed by an intervening `await`). `navigatePopup` then swaps
 * in the wallet URL without adding a history entry.
 */

const WIDTH = 480;
const HEIGHT = 720;

function featuresString(): string {
  const screenLeft = typeof window.screenLeft !== 'undefined' ? window.screenLeft : window.screenX;
  const screenTop = typeof window.screenTop !== 'undefined' ? window.screenTop : window.screenY;
  const screenWidth = window.outerWidth || window.innerWidth || screen.width;
  const screenHeight = window.outerHeight || window.innerHeight || screen.height;
  const left = Math.max(0, screenLeft + Math.floor((screenWidth - WIDTH) / 2));
  const top = Math.max(0, screenTop + Math.floor((screenHeight - HEIGHT) / 3));
  return [
    `width=${WIDTH}`,
    `height=${HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    'popup=yes',
    'toolbar=no',
    'menubar=no',
    'location=no',
    'status=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
}

export function openPlaceholderPopup(name: string): Window | null {
  return window.open('about:blank', name, featuresString());
}

export function navigatePopup(popup: Window, url: string): void {
  popup.location.replace(url);
}

/**
 * Resolve when the popup posts a message matching `matchSuccess`; resolve
 * `undefined` on a `matchReject` message or on timeout; reject on abort.
 */
export function waitForOpenerMessage<T>(
  matchSuccess: (m: { type: string }) => boolean,
  matchReject: (m: { type: string }) => boolean,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const onMsg = (ev: MessageEvent) => {
      const m = ev.data as { type?: string };
      if (!m || typeof m.type !== 'string') return;
      const typed = m as { type: string };
      if (matchSuccess(typed)) {
        cleanup();
        resolve(m as T);
      } else if (matchReject(typed)) {
        cleanup();
        resolve(undefined);
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Operation aborted'));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, timeoutMs);
    window.addEventListener('message', onMsg);
    if (abortSignal) {
      if (abortSignal.aborted) {
        cleanup();
        reject(new Error('Operation aborted'));
        return;
      }
      abortSignal.addEventListener('abort', onAbort);
    }
  });
}
