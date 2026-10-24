import { TransportError } from '@partylayer/core';

/** A cached account must never turn an explicitly declined handshake into a connection. */
export function assertConnectionAccepted(result: unknown): void {
  if (result === false || (result && typeof result === 'object' && (result as { isConnected?: unknown }).isConnected === false)) {
    throw new TransportError('The wallet did not establish a connection');
  }
}

/** Wallets may expose partially initialized accounts; do not publish an empty identity. */
export function assertPrimaryParty(account: { partyId?: unknown } | null | undefined): asserts account is { partyId: string } {
  if (typeof account?.partyId !== 'string' || !account.partyId.trim()) throw new TransportError('The wallet did not return a primary party');
}
