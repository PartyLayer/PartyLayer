/** Browser client: preserve the full reviewed wallet catalog and discovery runtime. */
import { PartyLayerClientBase } from './client-base';
export { DEFAULT_CONNECT_TIMEOUT_MS } from './client-base';
import { getBuiltinAdapters } from './builtin-adapters';
import { loadDefaultWallet } from './default-wallets';
import { NativeConnectionOwner } from './native-owner';
import type { PartyLayerConfig } from './config';

export class PartyLayerClient extends PartyLayerClientBase {
  constructor(config: PartyLayerConfig) {
    super(config, {
      getBuiltinAdapters,
      loadDefaultWallet,
      createOwner: (onIdentityChanged) => new NativeConnectionOwner(onIdentityChanged),
      browserDiscovery: true,
    });
  }
}

/** Create a browser PartyLayer client with the supported default wallet catalog. */
export function createPartyLayer(config: PartyLayerConfig): PartyLayerClient {
  return new PartyLayerClient(config);
}
