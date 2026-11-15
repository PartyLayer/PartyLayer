import type { CIP0103Account } from '@partylayer/core';
import { createHostedWalletAdapter, type HostedWalletOptions, type HostedWalletProfile } from './hosted-wallet';
import { hostedRpcError } from './hosted-popup';

/**
 * Documented OneSwap hosted protocol, independently implemented (no vendor code).
 * https://www.npmjs.com/package/@oneswap/wallet-cip0103-adapter
 * See Low-level popup client, provider methods, options, and popup security model.
 * The published 0.2.0 package is a dev-only blackbox interoperability oracle.
 */
const profile: HostedWalletProfile = {
  providerId: 'oneswap-v2', name: 'OneSwap V2 Wallet', version: '0.1.0',
  popupName: 'oneswap-cip0103', readyType: 'oneswap:cip0103:ready', connectPath: '/connect',
  popupFeatures: 'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes',
  methods: { connect: 'canton_connect', disconnect: 'canton_disconnect', signMessage: 'canton_signMessage', prepareExecute: 'canton_prepareSignExecute' },
  account(result, networkId): CIP0103Account {
    const raw = result as { primaryAccount?: { partyId?: unknown; publicKey?: unknown } } | null;
    const primary = raw?.primaryAccount;
    if (typeof primary?.partyId !== 'string' || !primary.partyId.trim()) throw hostedRpcError(-32603, 'Hosted wallet returned no primary party');
    return { primary: true, partyId: primary.partyId, status: 'allocated', hint: 'OneSwap V2 wallet',
      publicKey: typeof primary.publicKey === 'string' ? primary.publicKey : '', namespace: 'oneswap',
      networkId, signingProviderId: 'oneswap-v2' };
  },
};

export function createOneSwapHostedAdapter(options: HostedWalletOptions) {
  return createHostedWalletAdapter(profile, options);
}
