import { describe, expect, it, vi } from 'vitest';
import { ValaProvider, memorySessionStore } from '@vala-wallet/dapp-sdk';
import type { CIP0103Provider } from '@partylayer/core';
import { submitViaPrepareExecute } from './prepare-execute';

// Exercise the installed official runtime, with only HTTP and popup boundaries
// controlled. No vendor private fields, live credentials or ledger writes.
describe('Vala published runtime receipt correlation', () => {
  it.each([true, false])('accepts only a matching command (matching=%s)', async (matching) => {
    const store = memorySessionStore();
    store.save({ token: 'test-only-token', sessionId: 'test-only-session' });
    const methods: string[] = [];
    const provider = new ValaProvider({
      host: 'https://wallet.example',
      dappOrigin: 'https://app.example',
      sessionStore: store,
      messages: { addEventListener() {}, removeEventListener() {} },
      openPopup: () => ({
        closed: false,
        location: { href: 'about:blank' },
        postMessage() {},
        close() {},
      }),
      fetch: vi.fn(async (_input, init) => {
        const request = JSON.parse(String(init?.body));
        methods.push(request.method);
        const result =
          request.method === 'prepareExecute'
            ? { commandId: 'requested-command', userUrl: 'https://wallet.example/approve' }
            : {
                commandId: matching ? 'requested-command' : 'unrelated-command',
                status: 'executed',
                payload: { updateId: 'controlled-ledger-update' },
              };
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
      }),
    });
    try {
      const result = submitViaPrepareExecute(
        provider as unknown as CIP0103Provider,
        { signedTx: { commandId: 'requested-command', commands: [] } },
        { walletId: 'vala', state: {} }
      );
      if (matching)
        await expect(result).resolves.toMatchObject({
          commandId: 'requested-command',
          updateId: 'controlled-ledger-update',
        });
      else await expect(result).rejects.toThrow(/commandId.*outcome.*unknown/i);
      expect(methods).toEqual(['prepareExecute', 'txChanged']);
    } finally {
      provider.teardown();
    }
  });
});
