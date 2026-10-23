import type { Session, SignedMessage, SignMessageParams } from '@partylayer/core';
import { toSignature, TransportError } from '@partylayer/core';

/** Normalize the CIP-0103 signature response into PartyLayer's public result. */
export function normalizeSignedMessage(
  response: unknown,
  session: Session,
  params: SignMessageParams,
): SignedMessage {
  const signature = typeof response === 'string'
    ? response : (response as { signature?: unknown } | null)?.signature;
  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new TransportError('The wallet returned an invalid message signature');
  }
  const reportedParty = response && typeof response === 'object'
    ? (response as { partyId?: unknown }).partyId : undefined;
  if (typeof reportedParty === 'string' && reportedParty !== session.partyId) {
    throw new TransportError('The wallet account changed while signing; reconnect before retrying');
  }
  return {
    signature: toSignature(signature),
    partyId: session.partyId,
    message: params.message,
    nonce: params.nonce,
    domain: params.domain,
  };
}
