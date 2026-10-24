'use client';

import { useMemo } from 'react';
import type { TokenHoldingRef, TokenInstrumentId } from './token-holdings';
import { useLocale } from './localization';
import { useTheme } from './theme';
import { summarizeTokenHoldings } from './token-balance-summary';

export interface TokenBalancesProps {
  owner: string;
  holdings: readonly TokenHoldingRef[];
  loading?: boolean;
  error?: Error | null;
  /** Resolve a human-readable instrument name from BOTH admin and id. */
  formatInstrument?: (instrument: TokenInstrumentId) => React.ReactNode;
}

/** Bind data to its exact account/network before passing it to ConnectButton. */
export interface AccountHoldings {
  partyId: string;
  networkId: string;
  holdings: readonly TokenHoldingRef[];
  loading?: boolean;
  error?: Error | null;
}

export function TokenBalances({ owner, holdings, loading, error, formatInstrument }: TokenBalancesProps) {
  const { t, locale, direction } = useLocale();
  const theme = useTheme();
  const result = useMemo(() => {
    try { return { balances: summarizeTokenHoldings(holdings, owner), error: null }; }
    catch (reason) { return { balances: [], error: reason instanceof Error ? reason : new Error('Invalid holdings data') }; }
  }, [holdings, owner]);
  const problem = error ?? result.error;
  return <section lang={locale} dir={direction} aria-label={t('tokenBalances')}
    style={{ padding: '12px 16px', fontFamily: theme.fontFamily, fontSize: '12px', color: theme.colors.text }}>
    <div style={{ fontWeight: 600, marginBottom: '8px' }}><bdi dir="auto">{t('tokenBalances')}</bdi></div>
    {loading ? <div role="status"><bdi dir="auto">{t('loadingBalances')}</bdi></div>
      : problem ? <div role="alert" style={{ color: theme.colors.error, overflowWrap: 'anywhere' }}><bdi dir="auto">{t('balancesFailed', { reason: problem.message })}</bdi></div>
      : !result.balances.length ? <div><bdi dir="auto">{t('noHoldings')}</bdi></div>
      : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{result.balances.map(balance => (
        <li key={JSON.stringify([balance.instrumentId.admin, balance.instrumentId.id])} style={{ padding: '6px 0', overflowWrap: 'anywhere' }}>
          <div style={{ fontWeight: 600 }}><bdi dir="auto">{formatInstrument?.(balance.instrumentId) ?? balance.instrumentId.id}</bdi></div>
          <div dir="ltr" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: theme.colors.textSecondary }}>{balance.instrumentId.admin}</div>
          <div><bdi dir="auto">{t('availableBalance', { amount: balance.available })}</bdi></div>
          <div><bdi dir="auto">{t('lockedBalance', { amount: balance.locked })}</bdi></div>
        </li>
      ))}</ul>}
  </section>;
}
