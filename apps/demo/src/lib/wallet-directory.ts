/**
 * Build-time view of the wallet registry, for the generated /wallets pages.
 *
 * SERVER ONLY. This module reads the filesystem, so it must never be imported
 * from a client component. Every page that uses it is statically prerendered,
 * so the read happens once at build time and no filesystem access survives into
 * the deployed runtime.
 *
 * The source is `apps/demo/public/registry/v1/stable/registry.json`, which
 * `scripts/copy-registry.mjs` writes from the repository's own `registry/`
 * directory on `prebuild` and `predev`. Reading the copy rather than the root
 * means the pages render the same bytes the demo serves to the SDK, with icon
 * URLs already rewritten to local paths.
 *
 * Consequence, and the point of doing it this way: a new wallet in the registry
 * produces its directory row and its own page on the next build with no page
 * file written by hand. Nothing here enumerates wallets.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registryEntryToWalletInfo } from '@partylayer/registry-client';
import type { RegistryWalletEntry } from '@partylayer/registry-client';
import { WALLET_NOTES, type WalletNote } from './wallet-notes';

/**
 * Wallets whose integration is already documented elsewhere on this site. Their
 * generated page defers to that page rather than competing with it: it declares
 * the existing page as its canonical and stays out of the index.
 */
const DOCUMENTED_ELSEWHERE: Record<string, string> = {
  send: '/docs/wallets/send',
};

const REGISTRY_PATH = join(
  process.cwd(),
  'public',
  'registry',
  'v1',
  'stable',
  'registry.json',
);

interface RegistryFile {
  metadata: {
    registryVersion: string;
    schemaVersion: string;
    publishedAt: string;
    channel: string;
    sequence: number;
    publisher: string;
  };
  wallets: RegistryWalletEntry[];
}

/**
 * Transport classes the registry client derives from each entry's real signals
 * (adapter transport plus installation hints), mapped to a reader-facing label.
 * The keys are `classifyWalletTransport`'s return values in
 * packages/registry-client/src/schema.ts; a class we have no label for falls
 * back to the raw key rather than being silently dropped.
 */
const TRANSPORT_LABELS: Record<string, string> = {
  extension: 'Browser extension',
  extensionMobile: 'Browser extension, with mobile deep link',
  mobile: 'Mobile, over a relay or deep link',
  popup: 'Hosted popup, no install',
  scan: 'QR or popup, opened by the wallet SDK',
  enterprise: 'Enterprise API, OAuth2',
};

/**
 * Registry capability flags mapped to the API that uses them. The right-hand
 * side names real exports: the hooks are verified against packages/react/src,
 * the client methods against packages/sdk.
 */
export const CAPABILITY_API: { key: string; label: string; api: string }[] = [
  { key: 'signMessage', label: 'Sign message', api: 'useSignMessage()' },
  { key: 'signTransaction', label: 'Sign transaction', api: 'useSignTransaction()' },
  { key: 'submitTransaction', label: 'Submit transaction', api: 'useSubmitTransaction()' },
  { key: 'transactionStatus', label: 'Report transaction status', api: 'submit result' },
  { key: 'switchNetwork', label: 'Switch network', api: 'client.switchNetwork()' },
  { key: 'multiParty', label: 'Multi-party', api: 'multi-party flows' },
];

export interface DirectoryWallet {
  id: string;
  name: string;
  description: string;
  homepage: string;
  icon: string;
  /** Derived by the registry client, not stored in the registry. */
  transport: string | undefined;
  transportLabel: string;
  networks: string[];
  capabilities: Record<string, boolean>;
  adapterPackage: string;
  sdkVersion: string;
  /** `true`, `false` or undefined when the entry declares nothing. */
  cip0103Native: boolean | undefined;
  cip0103Evidence: string | undefined;
  cip0103Since: string | undefined;
  note: WalletNote | undefined;
  /** Set when this wallet's integration is already documented on another page. */
  documentedAt: string | undefined;
  /** Only gated wallets enter the sitemap and stay indexable. See below. */
  indexable: boolean;
}

export interface RegistrySnapshot {
  publishedAt: string;
  sequence: number;
  channel: string;
  publisher: string;
  schemaVersion: string;
  wallets: DirectoryWallet[];
}

function readRegistry(): RegistryFile {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
  } catch (cause) {
    throw new Error(
      `Could not read the wallet registry at ${REGISTRY_PATH}. It is written by ` +
        `scripts/copy-registry.mjs, which runs on the demo's prebuild and predev ` +
        `hooks. Run \`pnpm --filter demo build\` (or \`dev\`) rather than invoking ` +
        `\`next build\` directly.`,
      { cause },
    );
  }
}

/**
 * The content gate.
 *
 * A generated page exists for every wallet in the registry, but only a wallet
 * with hand-written integration notes is indexable and listed in the sitemap.
 * A page whose only content is its registry row says nothing a reader cannot
 * get from the directory table, and thin near-duplicate pages are what put six
 * of this site's URLs into "crawled, currently not indexed" in the first place.
 *
 * To make a wallet's page indexable, add its entry to WALLET_NOTES.
 */
function isIndexable(entry: RegistryWalletEntry): boolean {
  // A wallet already documented elsewhere never becomes a second indexable URL
  // for the same subject, however good its notes are.
  if (DOCUMENTED_ELSEWHERE[entry.id]) return false;
  return WALLET_NOTES[entry.id] !== undefined;
}

export function getRegistrySnapshot(): RegistrySnapshot {
  const file = readRegistry();

  const wallets: DirectoryWallet[] = file.wallets.map((entry) => {
    // Reuse the shipped derivation rather than re-implementing it here, so the
    // transport shown on the page is the one the wallet picker actually uses.
    const info = registryEntryToWalletInfo(entry, 'stable');
    const transport = info.metadata?.transport;

    return {
      id: entry.id,
      name: entry.name,
      description: entry.description ?? '',
      homepage: entry.homepage ?? '',
      icon: entry.icon ?? '',
      transport,
      transportLabel: transport
        ? (TRANSPORT_LABELS[transport] ?? transport)
        : 'Not declared',
      networks: entry.supportedNetworks,
      capabilities: entry.capabilities as unknown as Record<string, boolean>,
      adapterPackage: entry.adapter.type,
      sdkVersion: entry.sdkVersion ?? '',
      cip0103Native: entry.cip0103?.native,
      cip0103Evidence: entry.cip0103?.evidence,
      cip0103Since: entry.cip0103?.since,
      note: WALLET_NOTES[entry.id],
      documentedAt: DOCUMENTED_ELSEWHERE[entry.id],
      indexable: isIndexable(entry),
    };
  });

  return {
    publishedAt: file.metadata.publishedAt,
    sequence: file.metadata.sequence,
    channel: file.metadata.channel,
    publisher: file.metadata.publisher,
    schemaVersion: file.metadata.schemaVersion,
    wallets,
  };
}

/** Every wallet id in the registry. Drives generateStaticParams. */
export function getAllWalletIds(): string[] {
  return getRegistrySnapshot().wallets.map((w) => w.id);
}

/** Wallet ids whose pages are indexable. Drives the sitemap. */
export function getIndexableWalletIds(): string[] {
  return getRegistrySnapshot()
    .wallets.filter((w) => w.indexable)
    .map((w) => w.id);
}

export function getWallet(id: string): DirectoryWallet | undefined {
  return getRegistrySnapshot().wallets.find((w) => w.id === id);
}
