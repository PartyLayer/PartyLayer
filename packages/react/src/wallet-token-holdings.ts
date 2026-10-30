'use client';

import { useMemo } from 'react';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { createWalletLedgerReader, createApplicationLedgerReader, type ApplicationLedgerReaderOptions, type WalletHoldingsSnapshot, type WalletLedgerReaderOptions } from '@partylayer/sdk';
import { toCAIP2Network } from '@partylayer/core';
import { usePartyLayerContext } from './context';

let serial = 0;
const sources = new WeakMap<object, number>();
function sourceId(client: object) {
  let id = sources.get(client);
  if (id === undefined) { id = ++serial; sources.set(client, id); }
  return id;
}

export interface UseWalletTokenHoldingsParameters extends WalletLedgerReaderOptions {
  holdingInterfaceId: string;
  /** Optional same-origin, server-authorized transport instead of wallet ledgerApi. */
  application?: Pick<ApplicationLedgerReaderOptions, 'endpoint' | 'sourceId' | 'origin' | 'fetch'>;
  /** Previous-account placeholder/initial data and custom query functions are intentionally excluded. */
  query?: Pick<UseQueryOptions<WalletHoldingsSnapshot, Error>, 'staleTime' | 'gcTime' | 'refetchInterval' | 'refetchOnWindowFocus'> & { enabled?: boolean };
}

/** Ready, authenticated holdings read via the connected wallet's CIP-0103 ledgerApi. */
export function useWalletTokenHoldings({ query, application, ...options }: UseWalletTokenHoldingsParameters) {
  const { client, session } = usePartyLayerContext();
  const { networkId, holdingInterfaceId, timeoutMs, maxContracts } = options;
  const reader = useMemo(() => client ? application
    ? createApplicationLedgerReader(client, { networkId, holdingInterfaceId, timeoutMs, maxContracts, ...application })
    : createWalletLedgerReader(client, { networkId, holdingInterfaceId, timeoutMs, maxContracts }) : null,
    [client, networkId, holdingInterfaceId, timeoutMs, maxContracts, application]);
  const activeNetwork = session ? toCAIP2Network(session.network).networkId : null;
  const result = useQuery<WalletHoldingsSnapshot, Error>({
    ...query,
    queryKey: ['partylayer', 'wallet-holdings', client ? sourceId(client) : null, session?.sessionId ?? null,
      session?.walletId ?? null, session?.partyId ?? null, activeNetwork, networkId, holdingInterfaceId, maxContracts ?? 1000,
      application?.endpoint ?? null, application?.sourceId ?? null],
    queryFn: ({ signal }) => { if (!reader) throw new Error('PartyLayer client is not ready'); return reader.readHoldings(signal); },
    enabled: Boolean(client && session && !session.networkMismatch && activeNetwork === networkId) && query?.enabled !== false,
    // A failing authorization, schema or snapshot check must not be hidden by retries.
    retry: false,
  });
  // Mask stale data on disconnect/mismatch even if a consumer manually refetches a disabled query.
  const snapshot = session && !session.networkMismatch && activeNetwork === networkId && result.data?.partyId === String(session.partyId) &&
    result.data.walletId === String(session.walletId) && result.data.networkId === networkId ? result.data : undefined;
  return { ...result, data: snapshot, snapshot, holdings: snapshot?.holdings };
}
