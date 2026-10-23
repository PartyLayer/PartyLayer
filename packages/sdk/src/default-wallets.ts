/** Reviewed, pinned official SDKs. Registry metadata never becomes executable imports. */
import type { NetworkId, OfficialAdapterFactory, OfficialProviderAdapter, WalletAdapter } from '@partylayer/core';
import type { PartyLayerConfig } from './config';
import { toCAIP2Network } from '@partylayer/core';

// Keep these imports dynamic: official SDKs may be ESM-only or browser-only.
// Loading completes during discovery, before the user's popup-opening click.
const loaders: Record<string, (network: NetworkId) => Promise<OfficialAdapterFactory>> = {
  walley: async () => {
    const { WalleyAdapter } = await import('@k2flabs/walley-dapp-sdk');
    return { providerId: 'walley', create: (host) => new WalleyAdapter({ host }) };
  },
  cauri: async () => {
    const { cauriAdapterFactory } = await import('@lithiumdigital/cauri-dapp-sdk');
    return cauriAdapterFactory as unknown as OfficialAdapterFactory;
  },
  oneswap: async (network) => {
    const { createOneSwapProviderAdapter } = await import('@oneswap/wallet-cip0103-adapter');
    return {
      providerId: 'oneswap',
      create: (host) => createOneSwapProviderAdapter({
        walletUrl: host,
        networkId: toCAIP2Network(network).networkId,
      }) as unknown as OfficialProviderAdapter,
    };
  },
  vala: async () => {
    const { valaAdapterFactory } = await import('@vala-wallet/dapp-sdk');
    return valaAdapterFactory as unknown as OfficialAdapterFactory;
  },
};

export async function loadDefaultWallet(
  id: string,
  config: PartyLayerConfig,
  origin: string,
): Promise<OfficialAdapterFactory | WalletAdapter | undefined> {
  if (id === 'walletconnect' && config.walletConnect?.projectId.trim()) {
    const { WalletConnectAdapter } = await import('@partylayer/adapter-walletconnect');
    return new WalletConnectAdapter({
      ...config.walletConnect,
      metadata: config.walletConnect.metadata ?? {
        name: config.app.name, description: config.app.name,
        url: origin === 'unknown' ? '' : origin, icons: [],
      },
    });
  }
  if (id === 'bron' && config.bron) {
    const { BronAdapter } = await import('@partylayer/adapter-bron');
    return new BronAdapter(config.bron);
  }
  return Object.prototype.hasOwnProperty.call(loaders, id) ? loaders[id](config.network) : undefined;
}
