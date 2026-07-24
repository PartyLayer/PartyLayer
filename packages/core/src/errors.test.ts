/**
 * Tests for the generic error mapper's classification branches, focused on the new
 * traffic branch: it must recognize the strings Canton actually produces, case
 * insensitively, and it must not swallow the existing rejected, timeout, or network
 * branches. The traffic branch is deliberately checked first because Canton's real
 * rejection string contains the word "rejected".
 */
import { describe, it, expect } from 'vitest';
import {
  mapUnknownErrorToPartyLayerError,
  InsufficientTrafficError,
  UserRejectedError,
  TimeoutError,
  TransportError,
  type ErrorMappingContext,
} from './errors';

const ctx: ErrorMappingContext = { phase: 'submitTransaction', walletId: 'loop' };

describe('mapUnknownErrorToPartyLayerError traffic branch', () => {
  it('classifies "insufficient traffic" case insensitively', () => {
    for (const message of [
      'insufficient traffic',
      'Insufficient Traffic',
      'INSUFFICIENT TRAFFIC to submit',
    ]) {
      const err = mapUnknownErrorToPartyLayerError(new Error(message), ctx);
      expect(err).toBeInstanceOf(InsufficientTrafficError);
      expect(err.code).toBe('INSUFFICIENT_TRAFFIC');
    }
  });

  it('classifies "AboveTrafficLimit" case insensitively', () => {
    for (const message of ['AboveTrafficLimit', 'abovetrafficlimit', 'ABOVETRAFFICLIMIT']) {
      const err = mapUnknownErrorToPartyLayerError(new Error(message), ctx);
      expect(err).toBeInstanceOf(InsufficientTrafficError);
      expect(err.code).toBe('INSUFFICIENT_TRAFFIC');
    }
  });

  it('classifies Canton\'s real rejection string as traffic, not user rejection', () => {
    // The word "rejected" appears in the string, so this proves the traffic branch
    // runs before the rejection branch.
    const message = 'Submission was rejected because not traffic is available: AboveTrafficLimit';
    const err = mapUnknownErrorToPartyLayerError(new Error(message), ctx);
    expect(err).toBeInstanceOf(InsufficientTrafficError);
    expect(err.code).toBe('INSUFFICIENT_TRAFFIC');
    expect(err.cause).toBeInstanceOf(Error);
    expect(err.details).toMatchObject({ phase: 'submitTransaction', walletId: 'loop' });
  });

  it('does not swallow the rejected, timeout, or network branches', () => {
    expect(mapUnknownErrorToPartyLayerError(new Error('User rejected the request'), ctx)).toBeInstanceOf(
      UserRejectedError,
    );
    expect(mapUnknownErrorToPartyLayerError(new Error('Operation timed out'), ctx)).toBeInstanceOf(
      TimeoutError,
    );
    expect(mapUnknownErrorToPartyLayerError(new Error('network connection failed'), ctx)).toBeInstanceOf(
      TransportError,
    );
  });
});
