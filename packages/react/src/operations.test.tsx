// @vitest-environment jsdom
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, TokenTransferInstructionV1Ref } from '@partylayer/core';
import type { TokenTransferInstructionRef } from './token-transfer-instructions';
import { TransferForm } from './transfer-form';
import { TransferInbox, getTransferInboxActions, type TransferInboxEntry } from './transfer-inbox';
import { OperationStatus, type OperationOutcome } from './operation-status';
import type { TransactionFlowRecord } from './use-transaction-flow';
import type { OperationPreparationContext } from './use-reviewed-transaction';
import { operationMessages } from './operation-messages';
import { PartyLayerLocaleProvider } from './localization';

expectTypeOf<TokenTransferInstructionV1Ref>().toEqualTypeOf<TokenTransferInstructionRef>();

const state = vi.hoisted(() => ({ session: null as Session | null, client: { getActiveSession: vi.fn(), submitTransaction: vi.fn() } }));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
const prepare = vi.fn(async (_input: unknown, context: OperationPreparationContext) => ({
  parameters: { signedTx: { commandId: context.commandId, commands: [{ ExerciseCommand: { choice: 'AppPreparedTransfer' } }] } }, expiresAt: Date.now() + 60_000,
}));
const options = { networkId: 'canton:da-devnet', prepare };
const instrumentId = { admin: 'issuer', id: 'USD' };
const v1 = (): TransferInboxEntry => ({ standard: 'v1', reference: { cid: 'offer-1', instruction: {
  transfer: { sender: 'bob', receiver: 'alice', amount: '2', instrumentId, requestedAt: '2026-01-01T00:00:00Z', executeBefore: '2099-01-01T00:00:00Z', inputHoldingCids: [] },
  status: { kind: 'pendingReceiverAcceptance' },
} } });
beforeEach(() => {
  state.session = { sessionId: 's1', walletId: 'vala', partyId: 'alice', network: 'devnet', capabilitiesSnapshot: ['submitTransaction'] } as Session;
  state.client.getActiveSession.mockReset().mockImplementation(async () => state.session);
  state.client.submitTransaction.mockReset().mockResolvedValue({ submittedAt: 1, updateId: 'actual-update' });
  prepare.mockClear();
});
afterEach(cleanup);

it('reviews a precise amount and issuer before one explicit wallet submission', async () => {
  render(<TransferForm {...options} instrumentId={instrumentId} />);
  fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'bob' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '9007199254740993.1234567890' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }));
  await screen.findByRole('button', { name: 'Approve in wallet' });
  expect(screen.getByText('9007199254740993.1234567890 USD')).not.toBeNull();
  expect(prepare).toHaveBeenCalledWith({ receiver: 'bob', amount: '9007199254740993.1234567890', instrumentId }, expect.objectContaining({ partyId: 'alice', networkId: options.networkId }));
  expect(state.client.submitTransaction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Approve in wallet' }));
  await waitFor(() => expect(state.client.submitTransaction).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Review transfer' })).toBeNull();
  expect(screen.queryByText('Transfer completed')).toBeNull();
});

it.each(['0', '-1', '1e4', '0.12345678901'])('rejects invalid transfer amount %s before preparation', async amount => {
  render(<TransferForm {...options} instrumentId={instrumentId} />);
  fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'bob' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } });
  fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }));
  expect(screen.getByRole('alert').textContent).toContain('positive amount');
  expect(prepare).not.toHaveBeenCalled();
});

it('does not offer a write action without a configured route or wallet capability', () => {
  render(<TransferForm networkId={options.networkId} instrumentId={instrumentId} />);
  expect(screen.queryByRole('button', { name: 'Review transfer' })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('unavailable');
});

it('offers V1 receiver acceptance/rejection, sender withdrawal and respects the pending workflow', () => {
  const offer = v1();
  expect(getTransferInboxActions(offer, 'alice')).toEqual(['accept', 'reject']);
  expect(getTransferInboxActions(offer, 'bob')).toEqual(['withdraw']);
  expect(getTransferInboxActions(offer, 'unrelated')).toEqual([]);
  if (offer.standard === 'v1') offer.reference.instruction.status = { kind: 'pendingInternalWorkflow', pendingActions: {} };
  expect(getTransferInboxActions(offer, 'alice')).toEqual([]);
});

it('rejects malformed instruction data before rendering an actionable offer', () => {
  const offer = v1(); offer.reference.instruction.transfer.amount = 'NaN';
  expect(getTransferInboxActions(offer, 'alice')).toEqual([]);
  render(<TransferInbox {...options} prepareAction={prepare} snapshot={{ walletId: 'vala', partyId: 'alice', networkId: options.networkId, entries: [offer] }} />);
  expect(screen.getByRole('alert')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
});

it('does not turn one member of a V2 joint-authorization group into a usable action', () => {
  const base = v1().reference.instruction.transfer;
  const offer: TransferInboxEntry = { standard: 'v2', reference: { cid: 'v2-offer', instruction: {
    transfer: { ...base, sender: { owner: 'bob', id: '' }, receiver: { owner: 'alice', provider: 'custodian', id: 'savings' } },
    availableActions: [[{ tag: 'TIA_Accept', value: {} }, [['alice', 'custodian']]]],
  } } };
  expect(getTransferInboxActions(offer, 'alice')).toEqual([]);
  render(<TransferInbox {...options} prepareAction={prepare} snapshot={{ walletId: 'vala', partyId: 'alice', networkId: options.networkId, entries: [offer] }} />);
  expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  expect(screen.getByText('Account savings')).not.toBeNull();
  expect(screen.getByText('Provider: custodian')).not.toBeNull();
});

it('requires an explicit reviewed inbox action and masks snapshots from another account/network', async () => {
  const snapshot = { walletId: 'vala', partyId: 'alice', networkId: options.networkId, entries: [v1()] };
  const view = render(<TransferInbox {...options} prepareAction={prepare} snapshot={snapshot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
  await screen.findByRole('button', { name: 'Approve in wallet' });
  expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ action: 'accept', entry: v1() }), expect.objectContaining({ partyId: 'alice' }));
  expect(state.client.submitTransaction).not.toHaveBeenCalled();
  view.rerender(<TransferInbox {...options} prepareAction={prepare} snapshot={{ ...snapshot, partyId: 'bob' }} />);
  expect(screen.queryByRole('button', { name: 'Approve in wallet' })).toBeNull();
});

const transaction: TransactionFlowRecord = { id: 'local', walletId: 'vala', partyId: 'alice', networkId: options.networkId,
  commandId: 'original', updateId: 'actual-update', status: 'confirmed', createdAt: 1, updatedAt: 2 };
const outcome: OperationOutcome = { sourceId: 'registry', walletId: 'vala', partyId: 'alice', networkId: options.networkId,
  commandId: 'original', updateId: 'actual-update', status: 'completed' };
it('requires correlated business evidence for completion and preserves pending acceptance after inclusion', () => {
  const view = render(<OperationStatus transaction={transaction} />);
  expect(screen.queryByText('Transfer completed')).toBeNull();
  expect(screen.getByText('Transfer outcome has not been verified yet')).not.toBeNull();
  for (const mismatch of [{ commandId: 'other' }, { updateId: 'other' }, { partyId: 'bob' }, { walletId: 'other' }, { networkId: 'canton:da-mainnet' }]) {
    view.rerender(<OperationStatus transaction={transaction} outcome={{ ...outcome, ...mismatch }} />);
    expect(screen.queryByText('Transfer completed')).toBeNull();
  }
  view.rerender(<OperationStatus transaction={transaction} outcome={{ ...outcome, status: 'pendingReceiverAcceptance' }} />);
  expect(screen.getByText('Waiting for recipient acceptance')).not.toBeNull();
  view.rerender(<OperationStatus transaction={transaction} outcome={outcome} />);
  expect(screen.getByText('Transfer completed')).not.toBeNull();
});

it('provides complete operation catalogs for all fourteen languages and keeps Arabic direction', async () => {
  expect(Object.keys(operationMessages)).toHaveLength(14);
  for (const messages of Object.values(operationMessages)) expect(Object.keys(messages).sort()).toEqual(Object.keys(operationMessages.en).sort());
  render(<PartyLayerLocaleProvider locale="ar"><TransferForm {...options} instrumentId={instrumentId} /></PartyLayerLocaleProvider>);
  const section = await screen.findByRole('region', { name: operationMessages.ar.sendTokens });
  expect(section.getAttribute('dir')).toBe('rtl');
});
