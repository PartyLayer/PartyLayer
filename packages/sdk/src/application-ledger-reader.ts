import { toCAIP2Network } from '@partylayer/core';
import { createScopedLedgerReader, type WalletLedgerClient, type WalletLedgerReaderOptions } from './wallet-ledger-reader';

export interface ApplicationLedgerReaderOptions extends WalletLedgerReaderOptions {
  /** Same-origin application endpoint implementing the narrow version-1 read contract. */
  endpoint: string;
  /** Stable app-owned ledger source name; never a caller-selected participant URL. */
  sourceId: string;
  /** Required outside the browser. In the browser it must equal location.origin. */
  origin?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Cookie-authenticated application read preset. The server must derive party and
 * network from its own session and rebuild authorized read filters. No wallet
 * capability is invented when the app backend, rather than the wallet, reads.
 */
export function createApplicationLedgerReader(client: WalletLedgerClient, options: ApplicationLedgerReaderOptions) {
  if (!/^[\w.:-]{1,100}$/.test(options.sourceId)) throw new Error('Invalid application ledger source id');
  return createScopedLedgerReader(client, options, async (session, resource, body, signal) => {
    const browserOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const origin = browserOrigin ?? options.origin;
    if (!origin || (browserOrigin && options.origin && options.origin !== browserOrigin)) throw new Error('Application reads require the current application origin');
    const base = new URL(origin);
    if (base.origin !== origin || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Invalid application origin');
    const url = new URL(options.endpoint, origin);
    if (url.origin !== origin || url.username || url.password || url.hash) throw new Error('Application ledger endpoint must be same-origin');
    if (!['/v2/state/ledger-end', '/v2/state/active-contracts', '/v2/updates/update-by-id'].includes(resource)) throw new Error('Unsupported application ledger read');
    const response = await (options.fetch ?? globalThis.fetch)(url.href, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal,
      body: JSON.stringify({ version: 1, sourceId: options.sourceId, partyId: String(session.partyId),
        networkId: toCAIP2Network(session.network).networkId, resource, ...(body ? { body } : {}) }),
    });
    if (!response.ok || !/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('Authorized application ledger read is unavailable');
    const raw = await response.text();
    if (raw.length > 8_000_000) throw new Error('Application ledger response is too large');
    const result = JSON.parse(raw);
    if (!result || result.version !== 1 || result.sourceId !== options.sourceId || result.partyId !== String(session.partyId) ||
      result.networkId !== options.networkId || result.resource !== resource || result.complete !== true || !Object.hasOwn(result, 'value')) {
      throw new Error('Incomplete or incorrectly scoped application ledger response');
    }
    return result.value;
  });
}
