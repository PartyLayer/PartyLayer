import type { NetworkId } from '@partylayer/core';

/** Canonical wallet id used across the registry, SDK and adapter. */
export const WALLEY_WALLET_ID = 'walley';

/** Marketing / install homepage shown in connect UIs. */
export const WALLEY_HOMEPAGE = 'https://walley.cc';

/** Walley is a hosted web wallet, so "install" is just visiting the site. */
export const WALLEY_INSTALL_URL = 'https://walley.cc';

/** Hosted Walley origin, keyed by Canton network. */
export const WALLEY_HOSTS: Record<string, string> = {
  mainnet: 'https://walley.cc',
};

/** Networks the hosted Walley wallet is available on. */
export const WALLEY_SUPPORTED_NETWORKS = ['mainnet'] as const;

/**
 * Walley signs every operation with an Ed25519 key derived from a WebAuthn
 * passkey (PRF extension). Surfaced in session metadata so dApps can tailor
 * copy ("approve in Touch ID / Face ID") instead of a generic prompt.
 */
export const WALLEY_SIGNING_METHOD = 'webauthn-prf' as const;

/** Popup paths on the Walley host, one per JSON-RPC surface. */
export const WALLEY_POPUP_PATHS = {
  connect: '/dapp/connect',
  sign: '/dapp/sign',
  execute: '/dapp/execute',
} as const;

/** Resolve the Walley host; a self-hosted override wins, else the hosted wallet. */
export function resolveWalleyHost(network: NetworkId, override?: string): string {
  if (override) return override.replace(/\/+$/, '');
  return (WALLEY_HOSTS[network] ?? WALLEY_HOSTS.mainnet).replace(/\/+$/, '');
}
