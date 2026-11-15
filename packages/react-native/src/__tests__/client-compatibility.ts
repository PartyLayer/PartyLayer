/** Compile-time contracts: bundled and external SDK clients remain accepted by hooks. */
import type { PartyLayerClient as BrowserSDKClient } from '@partylayer/sdk';
import type { PartyLayerClient as NativeSDKClient } from '@partylayer/sdk/native';
import type { PartyLayerClient } from '../client';
type Expect<T extends true> = T;
export type BrowserClientCompatibility = Expect<BrowserSDKClient extends PartyLayerClient ? true : false>;
export type NativeClientCompatibility = Expect<NativeSDKClient extends PartyLayerClient ? true : false>;
