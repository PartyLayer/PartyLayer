/**
 * Minimal local interfaces for the React Native modules this package uses.
 *
 * These describe only the small surface consumed here, so the package typechecks and
 * builds without installing react-native or AsyncStorage in CI, and without shipping a
 * `declare module 'react-native'` that could conflict with a consumer's own types. The
 * real modules are peer dependencies the consumer provides at runtime; they satisfy
 * these shapes structurally.
 */

/** The subset of React Native's `Linking` API used for deep link flows. */
export interface RNLinking {
  /** Open a URL (a deep link). */
  openURL(url: string): Promise<unknown>;
  /** Subscribe to inbound `url` events; returns a subscription with `remove()`. */
  addEventListener(
    type: 'url',
    handler: (event: { url: string }) => void
  ): { remove(): void };
  /** The URL that launched the app from a cold start, or `null`. */
  getInitialURL(): Promise<string | null>;
}

/** The subset of `@react-native-async-storage/async-storage` used for session storage. */
export interface RNAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}
