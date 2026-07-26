/**
 * React Native deep link platform.
 *
 * Implements the core {@link DeepLinkPlatform} on React Native's `Linking` API:
 * `openURL` opens the deep link, `addEventListener('url', ...)` receives callbacks
 * while the app runs, and `getInitialURL()` covers a cold start where the callback
 * launched the app. The subscription is removed on unsubscribe.
 *
 * `Linking` defaults to a static top level import from react-native, which is a REQUIRED
 * peer present in every React Native app, so a bundler includes it. The optional
 * parameter stays for injection and testing.
 */
import { Linking } from 'react-native';
import type { DeepLinkPlatform } from '@partylayer/core';
import type { RNLinking } from './types';

function resolveLinking(linking: RNLinking): RNLinking {
  if (!linking || typeof linking.openURL !== 'function' || typeof linking.addEventListener !== 'function') {
    throw new Error(
      'React Native Linking is not available. Use this platform inside a React Native app, ' +
        "or pass the Linking module: createReactNativeDeepLinkPlatform(Linking) after import { Linking } from 'react-native'.",
    );
  }
  return linking;
}

/**
 * Create a {@link DeepLinkPlatform} backed by React Native's `Linking`.
 * @param linking `Linking` module; defaults to the static react-native import.
 */
export function createReactNativeDeepLinkPlatform(linking: RNLinking = Linking): DeepLinkPlatform {
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
