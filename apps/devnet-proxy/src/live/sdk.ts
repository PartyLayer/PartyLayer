/**
 * Live sdk wiring. Builds the official @canton-network/wallet-sdk instance from env
 * (a static ledger token, the ledger JSON API url, and the Scan registry url), with
 * the token namespace extended. Auth stays server side; the token is never logged.
 *
 * The init here is the verified, compiling surface of wallet-sdk 1.4.0. The per flow
 * ledger and registry calls (holdings read mapping, transfer and allocation factory
 * flows, the DvP trade DAR choices) are named against real sdk capabilities in
 * backend.ts and completed on the validator side per RUNBOOK.md; they need a live
 * DevNet participant and a signing key to exercise.
 */
import { SDK } from '@canton-network/wallet-sdk';
import type { GatewayConfig } from '../config.js';

export type LiveSdk = Awaited<ReturnType<typeof buildSdk>>;

export async function buildSdk(cfg: GatewayConfig) {
  if (!cfg.live) throw new Error('buildSdk called without live config.');
  const auth = { method: 'static', token: cfg.live.ledgerAuthToken } as const;
  const base = await SDK.create({
    auth,
    ledgerClientUrl: cfg.live.ledgerJsonApiUrl,
  });
  // Extend with the token namespace so token standard reads and flows are available.
  const sdk = await base.extend({
    token: { auth, registries: [cfg.live.scanUrl] },
  });
  return sdk;
}
