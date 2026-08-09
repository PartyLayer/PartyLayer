export const WINTIP_WALLET_ID = 'wintip';

/**
 * Wintip's own status().provider.id — see wallet/lib/cip103/rpcServer.ts in
 * the wintip.cc repo. Used to confirm an already-injected window.canton
 * actually belongs to Wintip (not some other wallet that got there first),
 * the same "kernel mismatch" check Send does for its own provider.id.
 */
export const WINTIP_PROVIDER_ID = 'wintip-wallet';

export const WINTIP_HOMEPAGE = 'https://wintip.cc';

/** Where wintip-provider.js is served from — dApps include this as a <script> tag. */
export const WINTIP_WALLET_URL = 'https://wallet.wintip.cc';

export const WINTIP_PROVIDER_SCRIPT_URL = `${WINTIP_WALLET_URL}/wintip-provider.js`;

export const WINTIP_INSTALL_URL = `${WINTIP_WALLET_URL}/register`;

export const WINTIP_SUPPORTED_NETWORKS = ['mainnet'] as const;
