import type { usePartyLayer } from '@partylayer/react';
import { summarizeTokenHoldings, type TokenHoldingRef } from '@partylayer/react/query';

const HOLDING_INTERFACE = '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding';
type LedgerClient = Pick<ReturnType<typeof usePartyLayer>, 'ledgerApi'>;
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Read-only JSON Ledger API v2 example. Wallet permission and compatible Token Standard are required. */
export async function readWalletHoldings(client: LedgerClient, owner: string, signal?: AbortSignal): Promise<TokenHoldingRef[]> {
  const check = () => { if (signal?.aborted) throw new Error('Holdings query was cancelled'); };
  check();
  const end = await client.ledgerApi({ requestMethod: 'GET', resource: '/v2/state/ledger-end' });
  check();
  const offset = object(JSON.parse(end.response))?.offset;
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Ledger offset is unavailable or cannot be represented safely; use an authorized backend read');
  }
  const response = await client.ledgerApi({
    requestMethod: 'POST', resource: '/v2/state/active-contracts',
    body: JSON.stringify({ activeAtOffset: offset, eventFormat: {
      filtersByParty: { [owner]: { cumulative: [{ identifierFilter: { InterfaceFilter: {
        value: { interfaceId: HOLDING_INTERFACE, includeInterfaceView: true },
      } } }] } }, verbose: false,
    } }),
  });
  check();
  const parsed: unknown = JSON.parse(response.response);
  const wrapped = object(parsed);
  if (wrapped && Object.prototype.hasOwnProperty.call(wrapped, 'nextPageToken')) throw new Error('Holdings response is paginated; read all pages through your backend before displaying totals');
  const entries = Array.isArray(parsed) ? parsed : wrapped?.activeContracts;
  if (!Array.isArray(entries)) throw new Error('Invalid active-contracts response');
  const holdings: TokenHoldingRef[] = [];
  for (const entry of entries) {
    const created = object(object(object(object(entry)?.contractEntry)?.JsActiveContract)?.createdEvent);
    if (!created) throw new Error('Incomplete or unsupported contract entry; use an authorized backend read');
    const views = created.interfaceViews;
    if (!Array.isArray(views)) throw new Error('Holding interface views were not returned');
    const matched = views.filter(view => {
      const id = object(view)?.interfaceId;
      return typeof id === 'string' && id.endsWith(':Splice.Api.Token.HoldingV1:Holding');
    });
    if (!matched.length) throw new Error('The requested Holding interface view was not returned');
    for (const view of matched) {
      const value = object(object(view)?.viewValue);
      const instrument = object(value?.instrumentId);
      if (typeof created.contractId !== 'string' || !value || typeof value.owner !== 'string' ||
        typeof value.amount !== 'string' || typeof instrument?.admin !== 'string' || typeof instrument.id !== 'string') {
        throw new Error('Invalid Holding interface view');
      }
      holdings.push({ cid: created.contractId, holding: value as unknown as TokenHoldingRef['holding'] });
    }
  }
  summarizeTokenHoldings(holdings, owner);
  return holdings;
}
