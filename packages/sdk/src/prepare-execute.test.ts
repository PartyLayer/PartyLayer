/**
 * Execute-verb negotiation on the generic CIP-0103 paths.
 *
 * The behavioural contract, in order of how much damage getting it wrong would
 * do:
 *
 *   1. It never submits twice. A fallback fires a second submit, so it may only
 *      happen when the wallet rejected the METHOD and nothing reached the ledger.
 *   2. A wallet with the awaited verb gets a receipt carrying a real update id.
 *   3. A wallet without it keeps exactly today's behaviour, degraded not broken,
 *      and says so once.
 */
import { describe, it, expect, vi } from 'vitest';
import type { CIP0103Provider, LoggerAdapter } from '@partylayer/core';
import { submitViaPrepareExecute, type ExecuteVerbState } from './prepare-execute';

/** A wallet that rejects a method it does not implement, the way a real one does. */
function unsupported(code = 4200): Error {
  return Object.assign(new Error('Unsupported CIP-0103 method'), { code });
}

function makeProvider(handler: (method: string) => unknown): {
  provider: CIP0103Provider;
  calls: string[];
  request: ReturnType<typeof vi.fn>;
} {
  const calls: string[] = [];
  const request = vi.fn(async (args: { method: string }) => {
    calls.push(args.method);
    return handler(args.method);
  });
  const provider = {
    request,
    on: () => provider,
    emit: () => false,
    removeListener: () => provider,
  } as unknown as CIP0103Provider;
  return { provider, calls, request };
}

function makeLogger(): LoggerAdapter & { warn: ReturnType<typeof vi.fn> } {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerAdapter & { warn: ReturnType<typeof vi.fn> };
}

const EXECUTED = {
  tx: { commandId: 'cmd-1', payload: { updateId: 'update-1', completionOffset: 9 } },
};

const PARAMS = { signedTx: { commands: [{ CreateCommand: {} }] } };

function opts(state: ExecuteVerbState = {}, logger?: LoggerAdapter) {
  return { walletId: 'testwallet', state, logger };
}

describe('submitViaPrepareExecute', () => {
  describe('it never submits twice', () => {
    it('does not fall back after a user rejection', async () => {
      // The wallet DID show the transaction and the user declined. Falling back
      // would put it in front of them again.
      const rejected = Object.assign(new Error('User rejected'), { code: 4001 });
      const { provider, calls } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw rejected;
        return { transactionHash: 'should-never-happen' };
      });

      await expect(submitViaPrepareExecute(provider, PARAMS, opts())).rejects.toThrow(
        /User rejected/,
      );
      expect(calls).toEqual(['prepareExecuteAndWait']);
    });

    it('does not fall back after an uncoded failure', async () => {
      const { provider, calls } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw new Error('network went away');
        return { transactionHash: 'should-never-happen' };
      });

      await expect(submitViaPrepareExecute(provider, PARAMS, opts())).rejects.toThrow(
        /network went away/,
      );
      expect(calls).toEqual(['prepareExecuteAndWait']);
    });

    it('does not fall back when the awaited verb succeeds without an update id', async () => {
      // The transaction is already committed; a second submit would be far worse
      // than a thin receipt.
      const { provider, calls } = makeProvider((m) =>
        m === 'prepareExecuteAndWait' ? { tx: { commandId: 'c' } } : { transactionHash: 'x' },
      );

      const receipt = await submitViaPrepareExecute(provider, PARAMS, opts());

      expect(calls).toEqual(['prepareExecuteAndWait']);
      expect(receipt).toEqual({ tx: { commandId: 'c' } });
    });
  });

  describe('a wallet with the awaited verb', () => {
    it('returns a receipt carrying the real update id', async () => {
      const { provider } = makeProvider((m) => (m === 'prepareExecuteAndWait' ? EXECUTED : null));

      const receipt = await submitViaPrepareExecute(provider, PARAMS, opts());

      expect(receipt.updateId).toBe('update-1');
      expect(receipt.commandId).toBe('cmd-1');
      expect(String(receipt.transactionHash)).toBe('update-1');
      expect(receipt.submittedAt).toBeTypeOf('number');
    });

    it('forwards the caller params unchanged to the wallet', async () => {
      const { provider, request } = makeProvider(() => EXECUTED);

      await submitViaPrepareExecute(provider, PARAMS, opts());

      expect(request).toHaveBeenCalledWith({
        method: 'prepareExecuteAndWait',
        params: PARAMS,
      });
    });
  });

  describe('a wallet without the awaited verb', () => {
    it('falls back and returns exactly what the plain verb returned', async () => {
      // The OneSwap shape: its prepareExecute returns a usable object, and this
      // is the pre-fix behaviour that must not change.
      const plain = { transactionHash: '0xabc', updateId: 'oneswap-1', submittedAt: '2026-01-01' };
      const { provider, calls } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported(4200);
        return plain;
      });

      const receipt = await submitViaPrepareExecute(provider, PARAMS, opts());

      expect(calls).toEqual(['prepareExecuteAndWait', 'prepareExecute']);
      expect(receipt).toEqual(plain);
    });

    it('also falls back on JSON-RPC method-not-found', async () => {
      const { provider, calls } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported(-32601);
        return { transactionHash: '0xabc' };
      });

      await submitViaPrepareExecute(provider, PARAMS, opts());

      expect(calls).toEqual(['prepareExecuteAndWait', 'prepareExecute']);
    });

    it('returns null unchanged when the wallet is spec-conformant', async () => {
      // A conformant prepareExecute returns Null. This is the case the fix cannot
      // improve, and deliberately does not turn into an outage.
      const { provider } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported();
        return null;
      });

      await expect(submitViaPrepareExecute(provider, PARAMS, opts())).resolves.toBeNull();
    });
  });

  describe('it asks, and says so, once', () => {
    it('probes the awaited verb only on the first submit', async () => {
      const state: ExecuteVerbState = {};
      const { provider, calls } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported();
        return { transactionHash: '0xabc' };
      });

      await submitViaPrepareExecute(provider, PARAMS, opts(state));
      await submitViaPrepareExecute(provider, PARAMS, opts(state));
      await submitViaPrepareExecute(provider, PARAMS, opts(state));

      expect(calls.filter((m) => m === 'prepareExecuteAndWait')).toHaveLength(1);
      expect(calls.filter((m) => m === 'prepareExecute')).toHaveLength(3);
    });

    it('logs the missing verb once, naming the wallet', async () => {
      const state: ExecuteVerbState = {};
      const logger = makeLogger();
      const { provider } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported();
        return { transactionHash: '0xabc' };
      });

      await submitViaPrepareExecute(provider, PARAMS, opts(state, logger));
      await submitViaPrepareExecute(provider, PARAMS, opts(state, logger));

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const message = String(logger.warn.mock.calls[0][0]);
      expect(message).toContain('testwallet');
      expect(message).toContain('prepareExecuteAndWait');
    });

    it('says nothing when the wallet supports the awaited verb', async () => {
      const logger = makeLogger();
      const { provider } = makeProvider(() => EXECUTED);

      await submitViaPrepareExecute(provider, PARAMS, opts({}, logger));

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('works with no logger supplied', async () => {
      const { provider } = makeProvider((m) => {
        if (m === 'prepareExecuteAndWait') throw unsupported();
        return { transactionHash: '0xabc' };
      });

      await expect(submitViaPrepareExecute(provider, PARAMS, opts())).resolves.toEqual({
        transactionHash: '0xabc',
      });
    });
  });
});
