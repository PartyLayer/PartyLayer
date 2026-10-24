// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@partylayer/core';
import type { TokenHoldingRef } from './token-holdings';
import { summarizeTokenHoldings } from './token-balance-summary';
import { TokenBalances } from './token-balances';
import { ConnectButton } from './connect-button';

const state = vi.hoisted(() => ({ session: null as Session | null }));
vi.mock('./hooks', () => ({
  useClientSession: () => state.session,
  useWallets: () => ({ wallets: [], isLoading: false }),
  useConnect: () => ({ isConnecting: false }), useDisconnect: () => ({ disconnect: vi.fn() }),
}));
const holding = (cid: string, amount: string, admin = 'issuer-a', locked = false): TokenHoldingRef => ({
  cid, holding: { owner: 'alice', amount, instrumentId: { admin, id: 'TOKEN' },
    lock: locked ? { holders: ['locker'], expiresAt: '2000-01-01T00:00:00.000Z' } : undefined },
});
beforeEach(() => { state.session = { walletId: 'vala', partyId: 'alice', network: 'devnet' } as Session; });
afterEach(cleanup);

describe('token balance summaries', () => {
  it('separates issuers and locks, filters owners and preserves exact decimals', () => {
    const summaries = summarizeTokenHoldings([
      holding('1', '9007199254740993.1'), holding('2', '0.2'), holding('3', '2', 'issuer-a', true),
      holding('4', '100', 'issuer-b'), { ...holding('other-owner', '99'), holding: { ...holding('x', '99').holding, owner: 'bob' } },
    ], 'alice');
    expect(summaries).toEqual([
      { owner: 'alice', instrumentId: { admin: 'issuer-a', id: 'TOKEN' }, total: '9007199254740995.3', available: '9007199254740993.3', locked: '2', holdingCount: 3 },
      { owner: 'alice', instrumentId: { admin: 'issuer-b', id: 'TOKEN' }, total: '100', available: '100', locked: '0', holdingCount: 1 },
    ]);
  });
  it('rejects duplicates or malformed holdings instead of manufacturing zero balances', () => {
    expect(() => summarizeTokenHoldings([holding('duplicate', '2'), holding('duplicate', '2')], 'alice')).toThrow(/unique/);
    expect(() => summarizeTokenHoldings([holding('negative', '-1')], 'alice')).toThrow(/decimal string/);
    expect(() => summarizeTokenHoldings([{ cid: 'x' } as TokenHoldingRef], 'alice')).toThrow(/owner/);
  });
});

it('renders exact available and locked amounts, without treating an expired lock timestamp as an unlock', () => {
  render(<TokenBalances owner="alice" holdings={[holding('1', '9007199254740993.1'), holding('2', '2', 'issuer-a', true)]} />);
  expect(screen.getByText('Available: 9007199254740993.1')).not.toBeNull();
  expect(screen.getByText('Locked: 2')).not.toBeNull();
  expect(screen.getByText('issuer-a')).not.toBeNull();
});

it('shows invalid data as unavailable and loading/error states do not display stale balances', () => {
  const view = render(<TokenBalances owner="alice" holdings={[holding('1', '-4')]} />);
  expect(screen.getByRole('alert').textContent).toContain('Balances unavailable');
  expect(screen.queryByText(/Available:/)).toBeNull();
  view.rerender(<TokenBalances owner="alice" holdings={[holding('1', '42')]} loading />);
  expect(screen.getByRole('status').textContent).toContain('Loading balances');
  expect(screen.queryByText('Available: 42')).toBeNull();
  view.rerender(<TokenBalances owner="alice" holdings={[holding('1', '42')]} error={new Error('Ledger offline')} />);
  expect(screen.getByRole('alert').textContent).toContain('Ledger offline');
  expect(screen.queryByText('Available: 42')).toBeNull();
});

it('displays account-panel holdings only for the exact connected party and network', () => {
  const holdings = { partyId: 'alice', networkId: 'canton:da-devnet', holdings: [holding('1', '42')] };
  const view = render(<ConnectButton holdings={holdings} />);
  fireEvent.click(screen.getByRole('button', { name: 'alice' }));
  expect(screen.getByRole('region', { name: 'Token balances' })).not.toBeNull();
  for (const changed of [{ partyId: 'bob' }, { networkId: 'canton:da-mainnet' }]) {
    view.rerender(<ConnectButton holdings={{ ...holdings, ...changed }} />);
    expect(screen.queryByRole('region', { name: 'Token balances' })).toBeNull();
    expect(screen.queryByText('Available: 42')).toBeNull();
  }
});
