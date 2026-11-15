/**
 * Native-safe SDK entry. Only application-supplied transports are registered;
 * browser wallet runtimes are excluded and browser discovery stays disabled.
 */
import { PartyLayerClientBase } from './client-base';
import type { PartyLayerConfig as SharedPartyLayerConfig } from './config';

export type PartyLayerConfig = Omit<SharedPartyLayerConfig, 'walletConnect' | 'bron' | 'discovery'>;

export class PartyLayerClient extends PartyLayerClientBase {
  constructor(config: PartyLayerConfig) {
    if (('walletConnect' in config && config.walletConnect !== undefined) ||
        ('bron' in config && config.bron !== undefined)) {
      throw new Error('Automatic walletConnect/bron setup uses browser wallet runtimes. On native platforms, register a native-compatible WalletAdapter or provider through adapters.');
    }
    super({
      ...config,
      app: { ...config.app, origin: config.app.origin ?? 'unknown' },
      adapters: config.adapters ?? [],
      discovery: { announce: false },
    }, { noWalletsMessage: 'No native wallet transports are configured. Register a native-compatible adapter through adapters.' });
  }
}

/** Create a native client for explicitly supplied native-compatible adapters. */
export function createPartyLayer(config: PartyLayerConfig): PartyLayerClient {
  return new PartyLayerClient(config);
}

export type { ConnectOptions, WalletFilter, AdapterClass } from './config';
export { createWalletLedgerReader } from './wallet-ledger-reader';
export { createApplicationLedgerReader } from './application-ledger-reader';
export type { WalletLedgerClient, WalletLedgerReader, WalletLedgerReaderOptions } from './wallet-ledger-reader';
export type { ApplicationLedgerReaderOptions } from './application-ledger-reader';
