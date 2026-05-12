import type { ProviderDetection } from '@partylayer/core';

/**
 * Chrome Web Store extension ID for Send Canton Wallet.
 *
 * Kept as a public export for diagnostics and back-compat (downstream
 * consumers still import this constant), but it is **not** the primary
 * detection signal anymore. Detection is registry-driven via
 * `SEND_BUILTIN_DETECTION` below; the kernel.id is one of three matchers
 * (the URL-domain matchers carry stable identity, including for
 * developer-mode builds whose kernel.id varies per install).
 */
export const SEND_KERNEL_ID = 'ldmohiccoioolenadmogclhoklmanpgi';

/**
 * Built-in fallback detection patterns, mirroring the canonical Send
 * registry entry's `providerDetection`. Used when no registry entry is
 * injected at adapter construction time so adapter-only installs (no
 * registry fetch yet, or registry fetch failed) still recognise Send.
 *
 * If Send's identity signals change in the future, update both this
 * constant AND the registry entry — the registry is canonical, this is
 * the defensive mirror. The parity is verified by a test in
 * `send-adapter.test.ts`.
 */
export const SEND_BUILTIN_DETECTION: ProviderDetection = {
  transport: 'window.canton',
  matchers: [
    { field: 'kernel.url', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.userUrl', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.id', match: 'exact', values: [SEND_KERNEL_ID] },
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
