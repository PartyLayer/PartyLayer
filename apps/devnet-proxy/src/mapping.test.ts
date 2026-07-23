/**
 * Mapping unit tests: ledger-shaped ACS payloads into the CIP-0056 ref shapes.
 * Run with `npm test` (node --test via tsx). No SDK or network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapHolding,
  mapTransferInstruction,
  mapInstructionStatus,
  mapAllocation,
  mapAllocationRequest,
} from './mapping.js';

test('mapHolding: view plus lock, cid carried from the contract id', () => {
  const ref = mapHolding({
    contractId: '00holding',
    view: {
      owner: 'alice::1220',
      instrumentId: { admin: 'registry::1220', id: 'Amulet' },
      amount: '150.0000000000',
      lock: { holders: ['issuer::1220'], expiresAt: '2027-01-01T00:00:00Z', context: 'frozen', expiresAfter: null },
      meta: { source: 'faucet' },
    },
  });
  assert.equal(ref.cid, '00holding');
  assert.equal(ref.holding.owner, 'alice::1220');
  assert.equal(ref.holding.instrumentId.id, 'Amulet');
  assert.equal(ref.holding.amount, '150.0000000000'); // decimal string preserved verbatim
  assert.deepEqual(ref.holding.lock?.holders, ['issuer::1220']);
  assert.equal(ref.holding.lock?.context, 'frozen');
  assert.equal(ref.holding.lock?.expiresAfter, undefined); // Optional null maps to undefined
  assert.deepEqual(ref.holding.meta, { source: 'faucet' });
});

test('mapHolding: absent lock maps to undefined', () => {
  const ref = mapHolding({
    contractId: '00h2',
    view: { owner: 'bob::1220', instrumentId: { admin: 'r::1', id: 'Amulet' }, amount: '10.00', lock: null, meta: null },
  });
  assert.equal(ref.holding.lock, undefined);
  assert.equal(ref.holding.meta, undefined);
});

test('mapInstructionStatus: both variants', () => {
  assert.deepEqual(mapInstructionStatus({ tag: 'TransferPendingReceiverAcceptance', value: {} }), {
    kind: 'pendingReceiverAcceptance',
  });
  assert.deepEqual(
    mapInstructionStatus({ tag: 'TransferPendingInternalWorkflow', value: { pendingActions: { 'registry::1': 'sign' } } }),
    { kind: 'pendingInternalWorkflow', pendingActions: { 'registry::1': 'sign' } },
  );
});

test('mapTransferInstruction: transfer plus status plus cid', () => {
  const ref = mapTransferInstruction({
    contractId: '00ti',
    view: {
      originalInstructionCid: null,
      transfer: {
        sender: 'bob::1220',
        receiver: 'alice::1220',
        amount: '25.00',
        instrumentId: { admin: 'r::1', id: 'Amulet' },
        requestedAt: '2026-07-22T09:00:00Z',
        executeBefore: '2027-01-01T00:00:00Z',
        inputHoldingCids: ['00h-bob'],
        meta: { memo: 'lunch' },
      },
      status: { tag: 'TransferPendingReceiverAcceptance', value: {} },
      meta: null,
    },
  });
  assert.equal(ref.cid, '00ti');
  assert.equal(ref.instruction.transfer.amount, '25.00');
  assert.deepEqual(ref.instruction.transfer.inputHoldingCids, ['00h-bob']);
  assert.equal(ref.instruction.status.kind, 'pendingReceiverAcceptance');
  assert.equal(ref.instruction.originalInstructionCid, undefined);
});

test('mapAllocation: nested spec plus holdingCids', () => {
  const ref = mapAllocation({
    contractId: '00alloc',
    view: {
      allocation: {
        settlement: {
          executor: 'venue::1220',
          settlementRef: { id: 'trade-1', cid: '00req' },
          requestedAt: '2026-07-22T09:00:00Z',
          allocateBefore: '2027-01-01T00:00:00Z',
          settleBefore: '2027-01-02T00:00:00Z',
          meta: null,
        },
        transferLegId: 'leg-usd',
        transferLeg: {
          sender: 'alice::1220',
          receiver: 'bob::1220',
          amount: '100.00',
          instrumentId: { admin: 'r::1', id: 'DEMO-USD' },
          meta: null,
        },
      },
      holdingCids: ['00h-alice'],
      meta: null,
    },
  });
  assert.equal(ref.cid, '00alloc');
  assert.equal(ref.allocation.allocation.transferLegId, 'leg-usd');
  assert.equal(ref.allocation.allocation.transferLeg.amount, '100.00');
  assert.equal(ref.allocation.allocation.settlement.settlementRef.cid, '00req');
  assert.deepEqual(ref.allocation.holdingCids, ['00h-alice']);
});

test('mapAllocationRequest: TextMap transferLegs keyed by leg id', () => {
  const ref = mapAllocationRequest({
    contractId: '00req',
    view: {
      settlement: {
        executor: 'venue::1220',
        settlementRef: { id: 'trade-1', cid: '00req' },
        requestedAt: '2026-07-22T09:00:00Z',
        allocateBefore: '2027-01-01T00:00:00Z',
        settleBefore: '2027-01-02T00:00:00Z',
        meta: null,
      },
      transferLegs: {
        'leg-usd': { sender: 'alice::1220', receiver: 'bob::1220', amount: '100.00', instrumentId: { admin: 'r::1', id: 'DEMO-USD' }, meta: null },
        'leg-bond': { sender: 'bob::1220', receiver: 'alice::1220', amount: '5.00', instrumentId: { admin: 'r::1', id: 'DEMO-BOND' }, meta: null },
      },
      meta: null,
    },
  });
  assert.equal(ref.cid, '00req');
  assert.deepEqual(Object.keys(ref.request.transferLegs), ['leg-usd', 'leg-bond']);
  assert.equal(ref.request.transferLegs['leg-usd'].instrumentId.id, 'DEMO-USD');
  assert.equal(ref.request.transferLegs['leg-bond'].amount, '5.00');
});
