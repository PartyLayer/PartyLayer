import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Session } from '@partylayer/core';
import { toPartyId } from '@partylayer/core';
import { normalizeSignedMessage } from './sign-message';

const session = { partyId: toPartyId('alice::wallet') } as Session;
describe('CIP-0103 message response normalization', () => {
  it('preserves a verifiable signature over the exact original message and completes the public result', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const message = 'Hello Canton — nonce=challenge-1; domain=dapp.example';
    const signature = sign(null, Buffer.from(message), privateKey).toString('base64url');
    const result = normalizeSignedMessage({ signature }, session, { message });
    expect(result.partyId).toBe(session.partyId);
    expect(result.message).toBe(message);
    expect(verify(null, Buffer.from(result.message), publicKey, Buffer.from(result.signature, 'base64url'))).toBe(true);
    expect(verify(null, Buffer.from('altered message'), publicKey, Buffer.from(result.signature, 'base64url'))).toBe(false);
    expect(normalizeSignedMessage(signature, session, { message })).toEqual(result);
  });

  it('refuses missing signatures and a wallet reporting a different account', () => {
    for (const response of [null, {}, { signature: 123 }, { signature: '' }, '   ']) {
      expect(() => normalizeSignedMessage(response, session, { message: 'hello' })).toThrow(/signature/);
    }
    expect(() => normalizeSignedMessage({ signature: 'opaque', partyId: 'bob::wallet' }, session,
      { message: 'hello' })).toThrow(/account changed/);
  });

  it.each([null, 123, {}, 'bob::wallet'])('rejects an explicitly malformed or changed reported party: %j', partyId => {
    expect(() => normalizeSignedMessage({ signature: 'opaque', partyId }, session, { message: 'hello' })).toThrow(/account changed/);
  });

  it.each([null, 123, {}, 'different'])('rejects an explicitly malformed or different reported message: %j', message => {
    expect(() => normalizeSignedMessage({ signature: 'opaque', message }, session, { message: 'hello' })).toThrow(/unexpected message/);
  });
});
