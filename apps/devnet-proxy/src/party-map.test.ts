/**
 * Party map unit tests: both directions (key to ledger id and back), including the
 * unknown-id passthrough. Run with `npm test` (node --test via tsx). No SDK or IO.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeToKey, makeToLedgerId, reverseLeg } from './party-map.js';

// issuer and venue deliberately share a ledger id (Amulet has no separate issuer).
const P = {
  alice: 'alice::1220a',
  bob: 'bob::1220b',
  venue: 'venue::1220v',
  issuer: 'venue::1220v',
};

test('forward: key maps to its ledger id, unknown key passes through', () => {
  const toLedgerId = makeToLedgerId(P);
  assert.equal(toLedgerId('alice'), 'alice::1220a');
  assert.equal(toLedgerId('venue'), 'venue::1220v');
  assert.equal(toLedgerId('registry'), 'registry'); // unknown key: passthrough
});

test('reverse: ledger id maps back to its key', () => {
  const toKey = makeToKey(P);
  assert.equal(toKey('alice::1220a'), 'alice');
  assert.equal(toKey('bob::1220b'), 'bob');
});

test('reverse: unknown id passes through unchanged', () => {
  const toKey = makeToKey(P);
  assert.equal(toKey('registry::1220c0ffee'), 'registry::1220c0ffee');
  assert.equal(toKey('alice'), 'alice'); // already a key, not a known ledger id: passthrough
});

test('reverse: a shared ledger id resolves to the first key in P (venue before issuer)', () => {
  const toKey = makeToKey(P);
  assert.equal(toKey('venue::1220v'), 'venue');
});

test('round trip: key to ledger id and back returns the key', () => {
  const toLedgerId = makeToLedgerId(P);
  const toKey = makeToKey(P);
  for (const key of ['alice', 'bob', 'venue']) {
    assert.equal(toKey(toLedgerId(key)), key);
  }
});

test('reverseLeg: sender and receiver become keys, raw ledger ids kept, other fields preserved', () => {
  const toKey = makeToKey(P);
  const out = reverseLeg({ sender: 'alice::1220a', receiver: 'bob::1220b', amount: '5.00' }, toKey);
  assert.equal(out.sender, 'alice');
  assert.equal(out.receiver, 'bob');
  assert.equal(out.senderLedgerId, 'alice::1220a');
  assert.equal(out.receiverLedgerId, 'bob::1220b');
  assert.equal(out.amount, '5.00');
});
