/**
 * Tests for session utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateSessionId,
  validateSession,
  isSessionExpired,
  createSession,
} from './session';
import type { Session } from './types';

describe('session utilities', () => {
  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('validateSession', () => {
    it('should validate a valid session', () => {
      const session: Session = {
        sessionId: 'test',
        walletId: 'console',
        partyId: 'party::test',
        network: 'devnet',
        createdAt: Date.now(),
        origin: 'https://example.com',
        capabilitiesSnapshot: [],
      };
      expect(validateSession(session)).toBe(true);
    });

    it('should reject invalid sessions', () => {
      expect(validateSession(null)).toBe(false);
      expect(validateSession({})).toBe(false);
      expect(validateSession({ sessionId: 'test' })).toBe(false);
    });
  });

  describe('isSessionExpired', () => {
    it('should return false for sessions without expiration', () => {
      const session: Session = {
        sessionId: 'test',
        walletId: 'console',
        partyId: 'party::test',
        network: 'devnet',
        createdAt: Date.now(),
        origin: 'https://example.com',
      };
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true for expired sessions', () => {
      const session: Session = {
        sessionId: 'test',
        walletId: 'console',
        partyId: 'party::test',
        network: 'devnet',
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        origin: 'https://example.com',
      };
      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe('createSession', () => {
    it('should create a valid session', () => {
      const session = createSession(
        'console',
        'party::test',
        'devnet',
        'https://example.com'
      );
      expect(validateSession(session)).toBe(true);
      expect(session.walletId).toBe('console');
      expect(session.partyId).toBe('party::test');
      expect(session.network).toBe('devnet');
      expect(session.origin).toBe('https://example.com');
    });

    it('should set expiration if provided', () => {
      const expiresInMs = 3600000; // 1 hour
      const session = createSession(
        'console',
        'party::test',
        'devnet',
        'https://example.com',
        [], // capabilities
        expiresInMs
      );
      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt! - session.createdAt).toBe(expiresInMs);
    });
  });
});
