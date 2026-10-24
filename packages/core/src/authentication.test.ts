import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import {
  createAuthenticationChallenge, formatAuthenticationMessage, validateAuthenticationChallenge,
  verifyAuthenticationProof, type AuthenticationChallenge,
} from './authentication';

const now = Date.parse('2026-10-23T16:00:00.000Z');
const identity = { partyId: 'alice::authorized-party', networkId: 'canton:da-devnet' };
const origin = 'https://app.example';
const create = (overrides = {}) => createAuthenticationChallenge({
  ...identity, origin, nonce: randomBytes(32).toString('base64url'), now, ...overrides,
});

describe('authentication challenges', () => {
  it('binds every authentication field into readable, deterministic signed bytes', () => {
    const challenge = create();
    const message = formatAuthenticationMessage(challenge);
    for (const value of Object.values(challenge)) expect(message).toContain(String(value));
    expect(message).toContain('This does not authorize a transaction.');
    expect(formatAuthenticationMessage({ ...challenge })).toBe(message);
  });

  it.each([
    { origin: 'https://app.example/' }, { origin: 'http://app.example' },
    { origin: 'https://user@app.example' }, { origin: 'https://app.example/path' },
    { origin: 'https://app.example?redirect=evil' }, { partyId: 'alice\nOrigin: https://evil.example' },
    { partyId: '\u202ealice' }, { networkId: 'mainnet' }, { nonce: 'predictable' },
    { ttlMs: 0 }, { ttlMs: 600_001 }, { ttlMs: Number.NaN },
  ])('rejects ambiguous or unsafe input: %j', (overrides) => {
    expect(() => create(overrides)).toThrow();
  });

  it('allows HTTP only on exact local development origins', () => {
    for (const local of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      expect(create({ origin: local }).origin).toBe(local);
    }
    expect(() => create({ origin: 'http://localhost.evil.example' })).toThrow();
  });

  it('rejects expiry, future issuance, changed identity, origin, network and domain', () => {
    const challenge = create();
    const expected = { ...identity, origin };
    expect(() => validateAuthenticationChallenge(challenge, expected, now + 300_000)).toThrow(/expired/);
    expect(() => validateAuthenticationChallenge(challenge, expected, now - 1)).toThrow(/time/);
    for (const changed of [{ partyId: 'bob' }, { networkId: 'canton:da-mainnet' }, { origin: 'https://evil.example' }]) {
      expect(() => validateAuthenticationChallenge(challenge, { ...expected, ...changed }, now)).toThrow(/match/);
    }
    expect(() => validateAuthenticationChallenge({ ...challenge, domain: 'evil.example' }, expected, now)).toThrow(/match/);
  });
});

describe('server verification orchestration', () => {
  function backend(challenge = create()) {
    const pending = new Map([[challenge.nonce, challenge]]);
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const signature = sign(null, Buffer.from(formatAuthenticationMessage(challenge)), privateKey).toString('base64');
    const consumeChallenge = vi.fn(async (nonce: string) => {
      const stored = pending.get(nonce) ?? null;
      pending.delete(nonce); // Atomic in this single-process TEST; production uses a shared DB transaction.
      return stored;
    });
    const verifySignatureAndParty = vi.fn(async ({ message, signature: bytes, challenge: stored }: {
      message: string; signature: string; challenge: AuthenticationChallenge;
    }) => stored.partyId === identity.partyId && stored.networkId === identity.networkId &&
      verify(null, Buffer.from(message), publicKey, Buffer.from(bytes, 'base64')));
    return {
      proof: { nonce: challenge.nonce, signature }, origin, now,
      consumeChallenge, verifySignatureAndParty,
    };
  }

  it('verifies actual signatures against an independently trusted party/key mapping', async () => {
    await expect(verifyAuthenticationProof(backend())).resolves.toEqual(identity);
  });

  it('allows exactly one verification when the same proof is replayed concurrently', async () => {
    const parameters = backend();
    const results = await Promise.allSettled([
      verifyAuthenticationProof(parameters), verifyAuthenticationProof(parameters),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(parameters.verifySignatureAndParty).toHaveBeenCalledTimes(1);
    await expect(verifyAuthenticationProof(parameters)).rejects.toThrow(/already used/);
  });

  it('rejects tampered signatures and consumes the failed challenge', async () => {
    const parameters = backend();
    parameters.proof.signature = randomBytes(64).toString('base64');
    await expect(verifyAuthenticationProof(parameters)).rejects.toThrow(/signature/);
    await expect(verifyAuthenticationProof(parameters)).rejects.toThrow(/already used/);
  });

  it('rejects a valid key that is not authorized for the requested party', async () => {
    await expect(verifyAuthenticationProof(backend(create({ partyId: 'bob::other-party' })))).rejects.toThrow(/authorization/);
  });

  it('rejects another origin or network before cryptographic verification', async () => {
    for (const policy of [{ origin: 'https://evil.example' }, { networkId: 'canton:da-mainnet' }]) {
      const parameters = { ...backend(), ...policy };
      await expect(verifyAuthenticationProof(parameters)).rejects.toThrow(/match/);
      expect(parameters.verifySignatureAndParty).not.toHaveBeenCalled();
    }
  });

  it('rejects expired challenges and invalid proofs before invoking the verifier', async () => {
    const expired = { ...backend(), now: now + 600_000 };
    await expect(verifyAuthenticationProof(expired)).rejects.toThrow(/expired/);
    expect(expired.verifySignatureAndParty).not.toHaveBeenCalled();
    const invalid = backend();
    invalid.proof.signature = ' ';
    await expect(verifyAuthenticationProof(invalid)).rejects.toThrow(/proof/);
    expect(invalid.consumeChallenge).not.toHaveBeenCalled();
  });
});
