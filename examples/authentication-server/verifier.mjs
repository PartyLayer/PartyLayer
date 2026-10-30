import { createPublicKey, verify } from 'node:crypto';

/** Server-owned party/key bindings, independently provisioned by the app operator. */
export function createAuthorizedVerifier(bindings) {
  if (!Array.isArray(bindings) || !bindings.length) throw new Error('Configure trusted party/key bindings before enabling sign-in');
  const keys = bindings.map(binding => {
    const { partyId, networkId, publicKeyPem, algorithm, signatureEncoding, messageEncoding } = binding;
    if (typeof partyId !== 'string' || !partyId || typeof networkId !== 'string' || !/^canton:[\w-]+$/.test(networkId) ||
      !['ed25519', 'p256-sha256-der', 'p256-sha256-p1363'].includes(algorithm) ||
      !['base64', 'hex'].includes(signatureEncoding) || !['utf8', 'base64-text'].includes(messageEncoding)) throw new Error('Invalid trusted signing profile');
    const key = createPublicKey(publicKeyPem);
    if (algorithm === 'ed25519' ? key.asymmetricKeyType !== 'ed25519' :
      key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Public key does not match signing profile');
    return { partyId, networkId, key, algorithm, signatureEncoding, messageEncoding };
  });
  return async ({ message, signature, challenge }) => {
    if (typeof signature !== 'string' || signature.length > 1024) return false;
    for (const profile of keys.filter(k => k.partyId === challenge.partyId && k.networkId === challenge.networkId)) {
      try {
        const bytes = profile.signatureEncoding === 'hex'
          ? (/^(?:[0-9a-f]{2})+$/.test(signature) ? Buffer.from(signature, 'hex') : null)
          : (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature) ? Buffer.from(signature, 'base64') : null);
        if (!bytes || bytes.toString(profile.signatureEncoding) !== signature) continue;
        if (profile.algorithm === 'p256-sha256-der') {
          // Canonical ASN.1 DER sequence of two positive, minimally encoded integers.
          if (bytes.length < 8 || bytes.length > 72 || bytes[0] !== 0x30 || bytes[1] !== bytes.length - 2) continue;
          let offset = 2;
          let valid = true;
          for (let i = 0; i < 2; i++) {
            if (bytes[offset++] !== 2) { valid = false; break; }
            const length = bytes[offset++]; const first = bytes[offset];
            if (!length || length > 33 || offset + length > bytes.length || first >= 128 ||
              (first === 0 && (length === 1 || bytes[offset + 1] < 128))) { valid = false; break; }
            offset += length;
          }
          if (!valid || offset !== bytes.length) continue;
        } else if (bytes.length !== 64) continue;
        const data = Buffer.from(profile.messageEncoding === 'base64-text' ? Buffer.from(message, 'utf8').toString('base64') : message, 'utf8');
        if (verify(profile.algorithm === 'ed25519' ? null : 'sha256', data,
          { key: profile.key, dsaEncoding: profile.algorithm === 'p256-sha256-p1363' ? 'ieee-p1363' : 'der' }, bytes)) return true;
      } catch { /* An invalid signature/profile never authenticates. */ }
    }
    return false;
  };
}
