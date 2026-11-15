/** Shared bindings without loading the browser DiscoveryClient implementation. */
import type { WalletAdapter } from '@partylayer/core';
import type { NativeConnectionOwner } from './native-owner';

export const nativeOwnerBindings = new WeakMap<object, NativeConnectionOwner>();
export const nativeAdapterCopies = new WeakMap<object, () => WalletAdapter>();
