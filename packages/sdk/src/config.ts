/** Browser options extend the transport-independent client configuration. */
import type { BronAdapterConfig } from '@partylayer/adapter-bron';
import type { WalletConnectAdapterConfig } from '@partylayer/adapter-walletconnect';
import type { PartyLayerBaseConfig } from './config-base';
export * from './config-base';

export interface PartyLayerConfig extends PartyLayerBaseConfig {
  /** Enable WalletConnect with your application's Cloud project id. */
  walletConnect?: WalletConnectAdapterConfig;
  /** Enable the Bron remote signer with your application's OAuth/API configuration. */
  bron?: BronAdapterConfig;
}
