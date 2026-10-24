/** Application authentication helpers. This message format is not a CIP-0103 standard. */
export interface AuthenticationIdentity {
  partyId: string;
  /** CAIP-2 network identifier, e.g. canton:da-devnet. */
  networkId: string;
}

export interface AuthenticationChallenge extends AuthenticationIdentity {
  version: 1;
  origin: string;
  domain: string;
  /** At least 128 bits of server-generated randomness; never reuse a nonce. */
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface CreateAuthenticationChallengeParameters extends AuthenticationIdentity {
  /** Trusted server configuration, never an unchecked request header. */
  origin: string;
  nonce: string;
  /** Server clock (epoch milliseconds). Defaults to Date.now(). */
  now?: number;
  /** Defaults to five minutes; cannot exceed ten minutes. */
  ttlMs?: number;
}

const MAX_TTL = 10 * 60_000;
const field = (value: string, name: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 ||
    // Reject control characters in fields displayed inside the signed message.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    throw new Error(`Invalid authentication ${name}`);
  }
  return value;
};

function canonicalOrigin(origin: string): URL {
  const url = new URL(field(origin, 'origin'));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.origin !== origin || url.username || url.password) {
    throw new Error('Authentication origin must be an exact HTTPS origin (HTTP is allowed on localhost)');
  }
  return url;
}

/** Create on the server, then store the complete challenge bound to the requesting browser. */
export function createAuthenticationChallenge(
  parameters: CreateAuthenticationChallengeParameters,
): AuthenticationChallenge {
  const { partyId, networkId, origin, nonce, now = Date.now(), ttlMs = 5 * 60_000 } = parameters;
  const challenge: AuthenticationChallenge = {
    version: 1, partyId, networkId, origin, domain: canonicalOrigin(origin).host, nonce,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString(),
  };
  validateAuthenticationChallenge(challenge, { origin, partyId, networkId }, now);
  return challenge;
}

/** Validate the exact identity, origin and time bounds before asking a wallet to sign. */
export function validateAuthenticationChallenge(
  challenge: AuthenticationChallenge,
  expected: AuthenticationIdentity & { origin: string },
  now = Date.now(),
): void {
  if (!challenge || challenge.version !== 1 || !Number.isFinite(now)) throw new Error('Invalid authentication challenge');
  const url = canonicalOrigin(challenge.origin);
  field(challenge.partyId, 'party');
  field(challenge.networkId, 'network');
  if (!/^canton:[A-Za-z0-9_-]{1,32}$/.test(challenge.networkId)) throw new Error('Invalid authentication network');
  if (challenge.origin !== expected.origin || challenge.domain !== url.host ||
    challenge.partyId !== expected.partyId || challenge.networkId !== expected.networkId) {
    throw new Error('Authentication challenge does not match the current origin, party or network');
  }
  if (typeof challenge.nonce !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(challenge.nonce)) {
    throw new Error('Invalid authentication nonce');
  }
  const issued = Date.parse(challenge.issuedAt);
  const expires = Date.parse(challenge.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now ||
    expires <= issued || expires - issued > MAX_TTL ||
    new Date(issued).toISOString() !== challenge.issuedAt || new Date(expires).toISOString() !== challenge.expiresAt) {
    throw new Error('Authentication challenge is expired or has invalid time bounds');
  }
}

/** All security-critical fields are inside the bytes passed to CIP-0103 signMessage. */
export function formatAuthenticationMessage(challenge: AuthenticationChallenge): string {
  // Validate structure independently of the current clock, so a persisted proof
  // always serializes identically. Verification separately checks actual expiry.
  validateAuthenticationChallenge(challenge, challenge, Date.parse(challenge.issuedAt));
  return [
    'PartyLayer Canton Sign-In', '',
    `Sign in to ${challenge.domain}. This does not authorize a transaction.`, '',
    `Origin: ${challenge.origin}`, `Party: ${challenge.partyId}`, `Network: ${challenge.networkId}`,
    `Nonce: ${challenge.nonce}`, `Issued At: ${challenge.issuedAt}`, `Expires At: ${challenge.expiresAt}`,
    `Version: ${challenge.version}`,
  ].join('\n');
}

export interface VerifyAuthenticationProofParameters {
  proof: { nonce: string; signature: string };
  /** Trusted server origin; do not derive from the proof. */
  origin: string;
  /** Optional server policy restricting the accepted network. */
  networkId?: string;
  /**
   * Atomically retrieve AND delete the server-stored challenge. Must also check
   * the requesting browser's pre-auth session/CSRF binding. Shared storage is
   * required across server processes. Failed attempts consume the nonce too.
   */
  consumeChallenge(nonce: string): Promise<AuthenticationChallenge | null>;
  /**
   * Verify the exact message signature AND independently authorize the signing
   * key for this party/network using trusted wallet/topology data. CIP-0103
   * does not fix a signature algorithm/encoding. Never trust a submitted key.
   */
  verifySignatureAndParty(parameters: {
    message: string;
    signature: string;
    challenge: AuthenticationChallenge;
  }): Promise<boolean>;
  now?: number;
}

/** Server-only orchestration. Issue an application session only after this resolves. */
export async function verifyAuthenticationProof(
  parameters: VerifyAuthenticationProofParameters,
): Promise<AuthenticationIdentity> {
  const { proof, origin, networkId, consumeChallenge, verifySignatureAndParty, now = Date.now() } = parameters;
  if (!proof || typeof proof.nonce !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(proof.nonce) ||
    typeof proof.signature !== 'string' || !proof.signature.trim() || proof.signature.length > 16_384) {
    throw new Error('Invalid authentication proof');
  }
  canonicalOrigin(origin);
  const challenge = await consumeChallenge(proof.nonce);
  if (!challenge || challenge.nonce !== proof.nonce) throw new Error('Authentication challenge is missing or already used');
  validateAuthenticationChallenge(challenge, {
    origin, partyId: challenge.partyId, networkId: networkId ?? challenge.networkId,
  }, now);
  const message = formatAuthenticationMessage(challenge);
  if (await verifySignatureAndParty({ message, signature: proof.signature, challenge }) !== true) {
    throw new Error('Authentication signature or party authorization is invalid');
  }
  // Signature verification may outlive the challenge's remaining validity.
  validateAuthenticationChallenge(challenge, challenge, parameters.now ?? Date.now());
  return { partyId: challenge.partyId, networkId: challenge.networkId };
}
