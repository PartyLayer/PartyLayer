/**
 * React Native deep link platform.
 *
 * Implements the core {@link DeepLinkPlatform} on React Native's `Linking` API:
 * `openURL` opens the deep link, `addEventListener('url', ...)` receives callbacks
 * while the app runs, and `getInitialURL()` covers a cold start where the callback
 * launched the app. The subscription is removed on unsubscribe.
 *
 * Pass the `Linking` module explicitly (`import { Linking } from 'react-native'`), or
 * call with no argument to have it loaded from react-native. A clear error is thrown
 * when react-native is not available and none was passed.
 */
import type { DeepLinkPlatform } from '@partylayer/core';
import type { RNLinking } from './types';
import { loadOptionalModule } from './optional-module';

function resolveLinking(linking?: RNLinking): RNLinking {
  const resolved =
    linking ??
    loadOptionalModule<RNLinking>('react-native', (mod) => (mod as { Linking?: RNLinking }).Linking);
  if (!resolved || typeof resolved.openURL !== 'function' || typeof resolved.addEventListener !== 'function') {
    throw new Error(
      'React Native Linking is not available. Use this platform inside a React Native app, ' +
        "or pass the Linking module: createReactNativeDeepLinkPlatform(Linking) after import { Linking } from 'react-native'.",
    );
  }
  return resolved;
}

/**
 * Create a {@link DeepLinkPlatform} backed by React Native's `Linking`.
 * @param linking Optional `Linking` module; loaded from react-native when omitted.
 */
export function createReactNativeDeepLinkPlatform(linking?: RNLinking): DeepLinkPlatform {
  const link = resolveLinking(linking);
  return {
    openUrl(url: string): void {
      // Fire and forget: the transport awaits the callback, not the open promise.
      void link.openURL(url);
    },
    subscribe(onCallback): () => void {
      const subscription = link.addEventListener('url', ({ url }) => {
        onCallback({ url });
      });
      // Cold start: the deep link may have launched the app before we subscribed.
      link
        .getInitialURL()
        .then((url) => {
          if (url) onCallback({ url });
        })
        .catch(() => {
          // A missing initial URL is normal; ignore.
        });
      return () => {
        subscription.remove();
      };
    },
  };
}
