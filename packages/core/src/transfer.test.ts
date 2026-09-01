import { describe, it, expect } from 'vitest';
import {
  toTransferIntent,
  TRANSFER_INTENT_FIELDS,
  type TransferIntent,
} from './transfer';
import { PartyLayerError } from './errors';

/** A minimal valid intent, reused across the suite. */
function validIntent(): TransferIntent {
  return {
    receiver: 'party::bob',
    amount: '10.5',
    instrumentId: { admin: 'party::registry', id: 'CC' },
  };
}

describe('toTransferIntent', () => {
  describe('the field allowlist', () => {
    // This is the test that makes "the user's approval cannot be suppressed by
    // the caller" a structural property rather than a promise. An adapter builds
    // its wallet request from the normalizer's output, so a key that does not
    // survive normalization can never reach a wallet that might honour it.
    it('drops a caller-supplied approval-suppressing option', () => {
      const result = toTransferIntent({
        ...validIntent(),
        skipConfirmation: true,
        autoApprove: true,
        silent: true,
      } as unknown);

      expect(result).not.toHaveProperty('skipConfirmation');
      expect(result).not.toHaveProperty('autoApprove');
      expect(result).not.toHaveProperty('silent');
    });

    it('drops a caller-supplied sender, so the acting party can only come from the session', () => {
      const result = toTransferIntent({
        ...validIntent(),
        sender: 'party::mallory',
        from: 'party::mallory',
        actAs: ['party::mallory'],
        partyId: 'party::mallory',
      } as unknown);

      expect(result).not.toHaveProperty('sender');
      expect(result).not.toHaveProperty('from');
      expect(result).not.toHaveProperty('actAs');
      expect(result).not.toHaveProperty('partyId');
    });

    it('drops caller-supplied holding selection and raw commands', () => {
      const result = toTransferIntent({
        ...validIntent(),
        inputHoldingCids: ['cid::1', 'cid::2'],
        commands: [{ CreateCommand: {} }],
        disclosedContracts: [{}],
      } as unknown);

      expect(result).not.toHaveProperty('inputHoldingCids');
      expect(result).not.toHaveProperty('commands');
      expect(result).not.toHaveProperty('disclosedContracts');
    });

    it('emits no key outside TRANSFER_INTENT_FIELDS, for any input', () => {
      const result = toTransferIntent({
        ...validIntent(),
        meta: { ref: 'inv-1' },
        executeBefore: '2026-12-31T23:59:59Z',
        anythingElse: 'x',
        nested: { deep: true },
      } as unknown);

      // Exhaustive: every key the normalizer can emit is declared in the
      // allowlist, so the allowlist cannot silently drift from the code.
      for (const key of Object.keys(result)) {
        expect(TRANSFER_INTENT_FIELDS).toContain(key);
      }
    });

    it('keeps every allowlisted field it is given', () => {
      const result = toTransferIntent({
        receiver: 'party::bob',
        amount: '10.5',
        instrumentId: { admin: 'party::registry', id: 'CC' },
        meta: { ref: 'inv-1' },
        executeBefore: '2026-12-31T23:59:59Z',
      });

      expect(result).toEqual({
        receiver: 'party::bob',
        amount: '10.5',
        instrumentId: { admin: 'party::registry', id: 'CC' },
        meta: { ref: 'inv-1' },
        executeBefore: '2026-12-31T23:59:59Z',
      });
    });

    it('exposes a frozen allowlist', () => {
      expect(Object.isFrozen(TRANSFER_INTENT_FIELDS)).toBe(true);
    });
  });

  describe('amount precision', () => {
    it('rejects a JS number rather than coercing it', () => {
      expect(() => toTransferIntent({ ...validIntent(), amount: 10.5 } as unknown)).toThrow(
        PartyLayerError,
      );
      expect(() => toTransferIntent({ ...validIntent(), amount: 10.5 } as unknown)).toThrow(
        /decimal string, not a number/,
      );
    });

    it('preserves a high-precision decimal string exactly', () => {
      const amount = '12345678901234567890.123456789012345678';
      expect(toTransferIntent({ ...validIntent(), amount }).amount).toBe(amount);
    });
  });

  describe('validation', () => {
    it('rejects a non-object intent', () => {
      expect(() => toTransferIntent(null)).toThrow(/must be an object/);
      expect(() => toTransferIntent('transfer')).toThrow(/must be an object/);
      expect(() => toTransferIntent([])).toThrow(/must be an object/);
    });

    it('rejects a missing or empty receiver', () => {
      const { receiver: _drop, ...noReceiver } = validIntent();
      expect(() => toTransferIntent(noReceiver)).toThrow(/"receiver"/);
      expect(() => toTransferIntent({ ...validIntent(), receiver: '' })).toThrow(/"receiver"/);
    });

    it('rejects an instrumentId missing its admin or id', () => {
      expect(() =>
        toTransferIntent({ ...validIntent(), instrumentId: { id: 'CC' } } as unknown),
      ).toThrow(/instrumentId\.admin/);
      expect(() =>
        toTransferIntent({ ...validIntent(), instrumentId: { admin: 'party::r' } } as unknown),
      ).toThrow(/instrumentId\.id/);
      expect(() =>
        toTransferIntent({ ...validIntent(), instrumentId: 'CC' } as unknown),
      ).toThrow(/"instrumentId"/);
    });

    it('rejects a non-string meta value rather than stringifying it', () => {
      expect(() =>
        toTransferIntent({ ...validIntent(), meta: { count: 3 } } as unknown),
      ).toThrow(/meta\.count/);
    });

    it('accepts an absent meta and an absent executeBefore', () => {
      const result = toTransferIntent(validIntent());
      expect(result.meta).toBeUndefined();
      expect(result.executeBefore).toBeUndefined();
    });

    it('throws a PartyLayerError, so callers can catch one error type', () => {
      expect(() => toTransferIntent({})).toThrow(PartyLayerError);
    });
  });
});
