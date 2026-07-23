/**
 * Environment configuration. Secrets (the ledger JWT) live only in process env and
 * are never returned by any endpoint or written to a log.
 */

export type GatewayMode = 'live' | 'mock';

export interface GatewayConfig {
  mode: GatewayMode;
  port: number;
  allowedOrigins: string[];
  /** Display names for the demo parties, returned by /config (never secrets). */
  parties: {
    issuer?: string;
    venue?: string;
    alice: string;
    bob: string;
  };
  /** Live-only ledger and registry settings. Absent in mock mode. */
  live?: {
    ledgerJsonApiUrl: string;
    ledgerAuthToken: string;
    scanUrl: string;
    partyAlice: string;
    partyBob: string;
    partyVenue: string;
  };
}

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') throw new Error('Missing required env var: ' + name);
  return v.trim();
}

function optList(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(): GatewayConfig {
  const mode: GatewayMode = process.env.GATEWAY_MODE === 'live' ? 'live' : 'mock';
  const port = parseInt(process.env.PORT || '8787', 10);
  const allowedOrigins = optList('ALLOWED_ORIGINS');

  const base: GatewayConfig = {
    mode,
    port,
    allowedOrigins,
    parties: {
      issuer: process.env.PARTY_ISSUER_LABEL || 'Issuer',
      venue: process.env.PARTY_VENUE_LABEL || 'Venue',
      alice: process.env.PARTY_ALICE_LABEL || 'Alice',
      bob: process.env.PARTY_BOB_LABEL || 'Bob',
    },
  };

  if (mode === 'live') {
    base.live = {
      ledgerJsonApiUrl: req('LEDGER_JSON_API_URL'),
      ledgerAuthToken: req('LEDGER_AUTH_TOKEN'),
      scanUrl: req('SCAN_URL'),
      partyAlice: req('PARTY_ALICE'),
      partyBob: req('PARTY_BOB'),
      partyVenue: req('PARTY_VENUE'),
    };
  }

  return base;
}

/** The /config payload: display info only, never secrets. */
export function publicConfig(cfg: GatewayConfig) {
  return {
    mode: cfg.mode,
    parties: cfg.parties,
    verticals: ['tokenization', 'dvp'],
  };
}
