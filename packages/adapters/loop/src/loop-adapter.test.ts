/**
 * Loop adapter compliance tests
 *
 * Note: Browser-dependent tests are skipped in Node.js environment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoopAdapter } from './loop-adapter';
import type { AdapterContext, Session, CapabilityKey, SessionId } from '@partylayer/core';
import {
  CapabilityNotSupportedError,
  toWalletId,
  toPartyId,
  toSessionId,
} from '@partylayer/core';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.com',
    network: 'devnet',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
      }),
  };
}

function createMockSession(): Session {
  return {
    sessionId: toSessionId('test-session'),
    walletId: toWalletId('loop'),
    partyId: toPartyId('party::test'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.com',
    capabilitiesSnapshot: ['connect', 'disconnect', 'ledgerApi'] as CapabilityKey[],
  };
}

describe('LoopAdapter', () => {
  let adapter: LoopAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new LoopAdapter();
    ctx = createMockContext();
    vi.clearAllMocks();
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('submitTransaction');
      expect(caps).toContain('ledgerApi');
      expect(caps).not.toContain('signTransaction');
    });
  });

  describe('detectInstalled', () => {
    it('should return false in Node.js environment (no browser)', async () => {
      const result = await adapter.detectInstalled();
      if (!isBrowser) {
        expect(result.installed).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });
  });

  describe('signTransaction', () => {
    it('should throw CapabilityNotSupportedError', async () => {
      const session = createMockSession();
      await expect(
        adapter.signTransaction(ctx, session, { tx: {} }),
      ).rejects.toThrow(CapabilityNotSupportedError);
    });
  });

  describe('ledgerApi', () => {
    it('should throw when not connected', async () => {
      const session = createMockSession();
      await expect(
        adapter.ledgerApi(ctx, session, {
          requestMethod: 'POST',
          resource: '/v2/state/acs',
          body: '{}',
        }),
      ).rejects.toThrow();
    });

    describe('with mock provider', () => {
      const mockProvider = {
        party_id: 'party::test',
        public_key: 'key123',
        getActiveContracts: vi.fn(),
        submitTransaction: vi.fn(),
        submitAndWaitForTransaction: vi.fn(),
        getHolding: vi.fn(),
        signMessage: vi.fn(),
      };

      beforeEach(() => {
        // Inject mock provider via private field
        (adapter as unknown as { currentProvider: unknown }).currentProvider = mockProvider;
        vi.clearAllMocks();
      });

      // ── ACS query ─────────────────────────────────────────────────

      it('should handle POST /v2/state/acs', async () => {
        const contracts = [
          { contractId: 'c1', payload: { amount: { initialAmount: '100' } } },
          { contractId: 'c2', payload: { amount: { initialAmount: '50' } } },
        ];
        mockProvider.getActiveContracts.mockResolvedValue(contracts);

        const result = await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/state/acs',
          body: JSON.stringify({
            filter: {
              filtersByParty: {
                'party::test': {
                  inclusive: {
                    templateFilters: [{ templateId: 'Splice.Amulet:Amulet' }],
                  },
                },
              },
            },
          }),
        });

        expect(mockProvider.getActiveContracts).toHaveBeenCalledWith({
          templateId: 'Splice.Amulet:Amulet',
          interfaceId: undefined,
        });

        const parsed = JSON.parse(result.response);
        expect(parsed.activeContracts).toHaveLength(2);
        expect(parsed.activeContracts[0].contractId).toBe('c1');
      });

      it('should handle POST /v2/state/active-contracts (alias)', async () => {
        mockProvider.getActiveContracts.mockResolvedValue([]);

        await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/state/active-contracts',
        });

        expect(mockProvider.getActiveContracts).toHaveBeenCalled();
      });

      it('should handle GET /v2/state/acs/active-contracts (unfiltered)', async () => {
        mockProvider.getActiveContracts.mockResolvedValue([
          { contractId: 'c1', payload: {} },
          { contractId: 'c2', payload: {} },
        ]);

        const result = await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'GET',
          resource: '/v2/state/acs/active-contracts',
        });

        expect(mockProvider.getActiveContracts).toHaveBeenCalledWith({
          templateId: undefined,
          interfaceId: undefined,
        });
        const parsed = JSON.parse(result.response);
        expect(parsed.activeContracts).toHaveLength(2);
      });

      it('should handle ACS query without body', async () => {
        mockProvider.getActiveContracts.mockResolvedValue([]);

        const result = await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/state/acs',
        });

        expect(mockProvider.getActiveContracts).toHaveBeenCalledWith({
          templateId: undefined,
          interfaceId: undefined,
        });
        const parsed = JSON.parse(result.response);
        expect(parsed.activeContracts).toEqual([]);
      });

      it('should handle ACS query with interfaceId filter', async () => {
        mockProvider.getActiveContracts.mockResolvedValue([]);

        await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/state/acs',
          body: JSON.stringify({
            filter: {
              filtersByParty: {
                'party::test': {
                  inclusive: {
                    templateFilters: [{ interfaceId: 'Splice.AmuletRules:AmuletRules' }],
                  },
                },
              },
            },
          }),
        });

        expect(mockProvider.getActiveContracts).toHaveBeenCalledWith({
          templateId: undefined,
          interfaceId: 'Splice.AmuletRules:AmuletRules',
        });
      });

      // ── Command submission ────────────────────────────────────────

      it('should handle POST /v2/commands/submit', async () => {
        const submitResult = { command_id: 'cmd1', submission_id: 'sub1' };
        mockProvider.submitTransaction.mockResolvedValue(submitResult);

        const result = await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/commands/submit',
          body: JSON.stringify({ commands: [{ exercise: {} }] }),
        });

        expect(mockProvider.submitTransaction).toHaveBeenCalled();
        expect(JSON.parse(result.response)).toEqual(submitResult);
      });

      it('should handle POST /v2/commands/submit-and-wait', async () => {
        const waitResult = { transaction: { updateId: 'u1' } };
        mockProvider.submitAndWaitForTransaction.mockResolvedValue(waitResult);

        const result = await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/commands/submit-and-wait',
          body: JSON.stringify({ commands: [{ create: {} }] }),
        });

        expect(mockProvider.submitAndWaitForTransaction).toHaveBeenCalled();
        expect(JSON.parse(result.response)).toEqual(waitResult);
      });

      it('should handle POST /v2/commands/submit-and-wait-for-transaction', async () => {
        mockProvider.submitAndWaitForTransaction.mockResolvedValue({});

        await adapter.ledgerApi(ctx, createMockSession(), {
          requestMethod: 'POST',
          resource: '/v2/commands/submit-and-wait-for-transaction',
          body: '{}',
        });

        expect(mockProvider.submitAndWaitForTransaction).toHaveBeenCalled();
      });

      // ── Unsupported endpoints ─────────────────────────────────────

      it('should throw for GET /v2/parties', async () => {
        await expect(
          adapter.ledgerApi(ctx, createMockSession(), {
            requestMethod: 'GET',
            resource: '/v2/parties',
          }),
        ).rejects.toThrow();
      });

      it('should throw for GET /v2/packages', async () => {
        await expect(
          adapter.ledgerApi(ctx, createMockSession(), {
            requestMethod: 'GET',
            resource: '/v2/packages',
          }),
        ).rejects.toThrow();
      });

      it('should throw for POST /v2/events/by-event-id', async () => {
        await expect(
          adapter.ledgerApi(ctx, createMockSession(), {
            requestMethod: 'POST',
            resource: '/v2/events/by-event-id',
            body: '{}',
          }),
        ).rejects.toThrow();
      });

      it('should include helpful error message for unsupported endpoints', async () => {
        try {
          await adapter.ledgerApi(ctx, createMockSession(), {
            requestMethod: 'GET',
            resource: '/v2/version',
          });
        } catch (err: unknown) {
          const msg = (err as Error).message;
          expect(msg).toContain('/v2/version');
          expect(msg).toContain('not supported');
        }
      });
    });
  });

  describe('adapter properties', () => {
    it('should have correct walletId', () => {
      expect(adapter.walletId).toBe(toWalletId('loop'));
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('5N Loop');
    });
  });
});
