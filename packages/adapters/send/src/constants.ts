/**
 * Chrome Web Store extension ID for Send Canton Wallet.
 *
 * Send exposes this as `status.kernel.id`. Because the Splice wallet kernel
 * spec parks the provider at the bare `window.canton` global, more than one
 * extension can — in principle — claim that slot. The kernel.id is what
 * lets us prove we are talking to Send rather than (e.g.) a Console-spec
 * wallet that follows the same protocol. Chrome guarantees extension IDs
 * are globally unique, so this string is safe to hard-code.
 */
export const SEND_KERNEL_ID = 'ldmohiccoioolenadmogclhoklmanpgi';

/**
 * Network IDs Send currently supports. Send is mainnet-only as of v0.2.0.
 * Listed in Canton long-form so it stays distinguishable from PartyLayer's
 * generic 'mainnet' alias.
 */
export const SEND_SUPPORTED_NETWORKS = ['canton:mainnet'] as const;

export const SEND_INSTALL_URL =
  'https://chromewebstore.google.com/detail/send/ldmohiccoioolenadmogclhoklmanpgi';

export const SEND_HOMEPAGE = 'https://cantonwallet.com';

export const SEND_DOCS_URL = 'https://sigilry.org';

/**
 * Send signs every transaction via the WebAuthn PRF extension (passkey).
 * Surfaced through session metadata so dApps can adapt copy ("approve in
 * Touch ID / Face ID prompt") rather than show a generic "open extension"
 * hint.
 */
export const SEND_SIGNING_METHOD = 'webauthn-prf' as const;
