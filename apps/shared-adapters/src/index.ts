/**
 * The single source for the wallet adapter set our demo surfaces register.
 *
 * Before this module, apps/demo, apps/tokenization and apps/dvp each built the
 * list by hand and had already drifted: Walley was a factory in one app and an
 * instance with a hardcoded host in the other two, and adding a wallet meant
 * editing three files. Adding a wallet is now one row in WALLET_BUILDERS below
 * plus its pinned dependency in this package's package.json.
 *
 * REPO-INTERNAL. This package is `private: true` and is never published.
 * Publishing a recommended adapter set for outside dApps is a separate product
 * decision and deliberately not what this is.
 *
 * Two things this module does NOT do, both on purpose:
 *
 *  - It does not read environment variables. Next inlines
 *    `process.env.NEXT_PUBLIC_*` at build time and Vite inlines
 *    `import.meta.env.VITE_*`; neither expression survives the other bundler,
 *    so no single expression here could serve all three apps. Every
 *    environment-derived value is passed in by the app that owns it.
 *  - It does not sort. The returned order is the declaration order of
 *    SHARED_WALLET_KEYS, stable across apps. apps/demo applies its own
 *    canonical order on top; the two verticals render the modal's default
 *    order. Sorting here would silently reorder two of the three surfaces.
 */

import type {
  NetworkId,
  WalletAdapter,
} from '@partylayer/core';
import { toCAIP2Network } from '@partylayer/core';
import type {
  OfficialProviderAdapter,
  OfficialAdapterFactory,
} from '@partylayer/sdk';
import { ConsoleAdapter } from '@partylayer/adapter-console';
import { SendAdapter } from '@partylayer/adapter-send';
import { LoopAdapter } from '@partylayer/adapter-loop';
import { Cantor8Adapter } from '@partylayer/adapter-cantor8';
import { NightlyAdapter } from '@partylayer/adapter-nightly';
import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import { BronAdapter, type BronAdapterConfig } from '@partylayer/adapter-bron';
// Walley and Cauri are the stable registry's two discovery-adapter (Path B)
// wallets. Both are third-party runtime dependencies shipped on public demo
// pages, so both are pinned exactly here rather than ranged.
import { WalleyAdapter } from '@k2flabs/walley-dapp-sdk';
import { cauriAdapterFactory } from '@lithiumdigital/cauri-dapp-sdk';
// OneSwap ships no ready factory and its constructor needs BOTH a wallet URL and
// a CAIP-2 networkId, so the factory below is ours. Pinned exactly, same reason.
import { createOneSwapProviderAdapter } from '@oneswap/wallet-cip0103-adapter';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Every wallet the shared set knows how to register. */
export type WalletKey =
  | 'console'
  | 'send'
  | 'loop'
  | 'cantor8'
  | 'nightly'
  | 'walley'
  | 'cauri'
  | 'oneswap'
  | 'walletconnect'
  | 'bron';

/** Anything PartyLayerKit accepts in its `adapters` prop. */
export type AdapterEntry =
  | WalletAdapter
  | OfficialProviderAdapter
  | OfficialAdapterFactory;

/** Pairing metadata a wallet sees over WalletConnect. */
export interface WalletConnectMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

export interface SharedAdapterOptions {
  /**
   * The network this app is configured for, the same value it passes to
   * PartyLayerKit. Needed because a discovery-adapter factory receives only a
   * host from the registry (`create(host)`), while OneSwap's constructor also
   * requires a CAIP-2 networkId. Taking it from the app, rather than hardcoding
   * one here, is what stops the host and the network from drifting apart if an
   * app ever moves off devnet.
   */
  network: NetworkId;
  /**
   * WalletConnect Cloud project id. Passed in, never read here: see the
   * environment note in this file's header.
   */
  walletConnectProjectId: string;
  /**
   * Optional pairing metadata. Only apps/demo sets it today; the verticals
   * register WalletConnect without it, which is the behaviour they had before
   * this module and is left unchanged rather than folded in silently.
   */
  walletConnectMetadata?: WalletConnectMetadata;
  /**
   * Bron OAuth and API configuration. Bron is an enterprise remote signer that
   * only works with real credentials, so OMITTING this means Bron is not
   * registered at all and the SDK hides it, rather than showing a wallet whose
   * click would dead-end at an OAuth error.
   */
  bron?: BronAdapterConfig;
  /**
   * Wallets this app deliberately does not carry. Every exclusion should carry
   * a comment at the call site naming the reason, so an omission always reads
   * as a decision rather than an oversight.
   */
  exclude?: readonly WalletKey[];
}

// ─── The set ────────────────────────────────────────────────────────────────

/**
 * The shared set, in the order it is returned. Adding a wallet is one entry
 * here plus its pinned dependency in this package's package.json.
 */
export const SHARED_WALLET_KEYS = [
  'console',
  'send',
  'loop',
  'cantor8',
  'nightly',
  'walley',
  'cauri',
  'oneswap',
  'walletconnect',
  'bron',
] as const satisfies readonly WalletKey[];

/**
 * One builder per wallet. A builder returns `null` when the wallet cannot be
 * registered with the configuration it was given (only Bron today), which is
 * different from being excluded: excluded means this app chose not to carry it.
 *
 * Walley and Cauri are FACTORY form, `{ providerId, create }`. The SDK resolves
 * the host from the registry entry's `adapter.networkHosts` for the active
 * network, so no wallet host is hardcoded anywhere in this file.
 */
const WALLET_BUILDERS: Record<
  WalletKey,
  (opts: SharedAdapterOptions) => AdapterEntry | null
> = {
  console: () => new ConsoleAdapter(),
  send: () => new SendAdapter(),
  loop: () => new LoopAdapter(),
  cantor8: () => new Cantor8Adapter(),
  nightly: () => new NightlyAdapter(),
  walley: () => ({
    providerId: 'walley',
    create: (host: string) => new WalleyAdapter({ host }),
  }),
  cauri: () => cauriAdapterFactory as AdapterEntry,
  // OneSwap is hosted and custodial: it approves and submits inside its own
  // popup origin. FACTORY form like Walley and Cauri, so the SDK resolves the
  // wallet URL from the registry entry's adapter.networkHosts for the active
  // network and no OneSwap URL appears in app code. networkId is derived from
  // the app's own network, so the two can never disagree.
  //
  // The registry's mainnet host is the WWW origin, not the apex. The adapter
  // compares event.origin on every popup message against the origin of the URL
  // it was configured with, and an origin check cannot follow a redirect:
  // https://oneswap.cc 308s to https://www.oneswap.cc, so configuring the apex
  // makes connect() time out with 4100 rather than fail fast. OneSwap documents
  // the same requirement from 0.2.0 onward.
  oneswap: (opts) => ({
    providerId: 'oneswap',
    create: (host: string) =>
      createOneSwapProviderAdapter({
        walletUrl: host,
        networkId: toCAIP2Network(opts.network).networkId,
      }) as unknown as OfficialProviderAdapter,
  }),
  walletconnect: (opts) =>
    new WalletConnectAdapter({
      projectId: opts.walletConnectProjectId,
      ...(opts.walletConnectMetadata
        ? { metadata: opts.walletConnectMetadata }
        : {}),
    }),
  bron: (opts) => (opts.bron ? new BronAdapter(opts.bron) : null),
};

/**
 * Build the adapter set for one app.
 *
 * Returns entries in SHARED_WALLET_KEYS order, minus anything the app excluded
 * and minus any wallet whose builder returned `null` for lack of configuration.
 */
export function buildWalletAdapters(
  opts: SharedAdapterOptions,
): AdapterEntry[] {
  const excluded = new Set<WalletKey>(opts.exclude ?? []);
  const out: AdapterEntry[] = [];
  for (const key of SHARED_WALLET_KEYS) {
    if (excluded.has(key)) continue;
    const entry = WALLET_BUILDERS[key](opts);
    if (entry) out.push(entry);
  }
  return out;
}

export type { BronAdapterConfig };
