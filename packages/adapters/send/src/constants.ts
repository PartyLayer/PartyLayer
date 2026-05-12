import type { ProviderDetection } from '@partylayer/core';

/**
 * Send Canton Wallet extension IDs.
 *
 * Send's runtime-injected CIP-103 provider reports its identity at
 * `window.canton.request({ method: 'status' }).provider.id`. The value
 * observed in production differs from the public Chrome Web Store
 * listing ID, so both are listed here. New IDs (e.g., from rebrands or
 * separate distribution channels) can be appended to this list without
 * code changes elsewhere.
 */
export const SEND_PRODUCTION_EXTENSION_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';
export const SEND_LEGACY_EXTENSION_ID = 'ldmohiccoioolenadmogclhoklmanpgi';

export const SEND_KNOWN_EXTENSION_IDS = [
  SEND_PRODUCTION_EXTENSION_ID,
  SEND_LEGACY_EXTENSION_ID,
] as const;

/**
 * @deprecated Use SEND_PRODUCTION_EXTENSION_ID or SEND_KNOWN_EXTENSION_IDS.
 * Retained for backward source-compatibility with consumers that import
 * the old name. Will be removed in a future major.
 */
export const SEND_KERNEL_ID = SEND_LEGACY_EXTENSION_ID;

/**
 * Built-in fallback detection patterns, mirroring the canonical Send
 * registry entry's `providerDetection`. Used when no registry entry is
 * injected at adapter construction time so adapter-only installs (no
 * registry fetch yet, or registry fetch failed) still recognise Send.
 *
 * Matchers are ordered: `provider.id` first (current production injection
 * shape — Send's status response has `{ connection, provider }`, not a
 * `kernel` field), then `kernel.*` fields (defensive — supports future
 * Send releases that may add a kernel field, and any non-Send wallet
 * that exposes kernel-shaped provider metadata at cantonwallet.com).
 *
 * If Send's identity signals change in the future, update both this
 * constant AND the registry entry — the registry is canonical, this is
 * the defensive mirror. The parity is verified by a test in
 * `send-adapter.test.ts`.
 */
export const SEND_BUILTIN_DETECTION: ProviderDetection = {
  transport: 'window.canton',
  matchers: [
    { field: 'provider.id', match: 'exact', values: [...SEND_KNOWN_EXTENSION_IDS] },
    { field: 'kernel.url', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.userUrl', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.id', match: 'exact', values: [...SEND_KNOWN_EXTENSION_IDS] },
  ],
};

/**
 * Network IDs Send currently supports. Send is mainnet-only as of v0.2.0.
 * Listed in Canton long-form so it stays distinguishable from PartyLayer's
 * generic 'mainnet' alias.
 */
export const SEND_SUPPORTED_NETWORKS = ['canton:mainnet'] as const;

export const SEND_INSTALL_URL = 'https://sigilry.org';

export const SEND_HOMEPAGE = 'https://cantonwallet.com';

export const SEND_DOCS_URL = 'https://sigilry.org';

/**
 * Send signs every transaction via the WebAuthn PRF extension (passkey).
 * Surfaced through session metadata so dApps can adapt copy ("approve in
 * Touch ID / Face ID prompt") rather than show a generic "open extension"
 * hint.
 */
export const SEND_SIGNING_METHOD = 'webauthn-prf' as const;
