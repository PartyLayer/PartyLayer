/** A closed read-only proxy. URLs, tokens, party filters and interface come from server policy. */
export function createAuthorizedLedgerProxy({ url, bearerToken, holdingInterfaceId, sourceId, networkId }) {
  const base = new URL(url);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Configure a trusted HTTPS ledger origin');
  if (typeof bearerToken !== 'string' || !bearerToken || !/^[\w.:-]{1,100}$/.test(sourceId) ||
    typeof holdingInterfaceId !== 'string' || !/^[^:#\s]+:[^:\s]+:[^:\s]+$/.test(holdingInterfaceId)) throw new Error('Incomplete server ledger policy');
  return async (identity, input) => {
    const denied = () => { throw Object.assign(new Error('Ledger read is not authorized'), { status: 403 }); };
    if (input.version !== 1 || input.sourceId !== sourceId || input.partyId !== identity.partyId || input.networkId !== networkId || identity.networkId !== networkId) denied();
    const resource = input.resource; let body;
    const filtersByParty = { [identity.partyId]: {} };
    if (resource === '/v2/state/active-contracts') {
      const offset = input.body?.activeAtOffset;
      if (!Number.isSafeInteger(offset) || offset < 0) denied();
      body = { activeAtOffset: offset, eventFormat: { filtersByParty: { [identity.partyId]: { cumulative: [{
        identifierFilter: { InterfaceFilter: { value: { interfaceId: holdingInterfaceId, includeInterfaceView: true } } },
      }] } }, verbose: false } };
    } else if (resource === '/v2/updates/update-by-id') {
      const updateId = input.body?.updateId;
      if (typeof updateId !== 'string' || !updateId || updateId.length > 2048 || /\p{Cc}/u.test(updateId)) denied();
      body = { updateId, updateFormat: { includeTransactions: { eventFormat: { filtersByParty, verbose: false }, transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA' } } };
    } else if (resource !== '/v2/state/ledger-end') denied();
    const response = await fetch(new URL(resource, base), { method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${bearerToken}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('Ledger source unavailable');
    const text = await response.text(); if (text.length > 8_000_000) throw new Error('Ledger response exceeds the read limit');
    const value = JSON.parse(text);
    return { version: 1, sourceId, partyId: identity.partyId, networkId, resource, complete: true, value };
  };
}
