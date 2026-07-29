// @vitest-environment jsdom
/**
 * Cantor8 adapter tests: the REBUILT adapter on the real @cantor8/wallet-connect-sdk.
 *
 * These unit-test the MAPPING and the DISCOVERY against a mock of the wallet's
 * own SDK; they do NOT prove a live connection. A real end-to-end run needs the
 * actual Cantor8 wallet (see the package README / PR notes).
 *
 * What is proven here:
 * - connect() reads the party from the SDK's getAccounts(), not from connect().
 * - the network guard rejects anything but devnet/mainnet before touching the SDK.
 * - submitTransaction() maps to the SDK's signAndExecute() with the right args.
 * - signMessage() FAILS cleanly (CapabilityNotSupportedError) and never routes
 *   through signAndExecute or resolves. The wallet has no message signing.
 * - detectInstalled() uses the wallet's own c8#provider_discovery event, not a
 *   user-agent sniff (it does not mislabel a desktop UA as unavailable, nor a
 *   mobile UA as available).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterContext, Session } from '@partylayer/core';

// Shared mock state for the SDK module (hoisted above the vi.mock factory).
const h = vi.hoisted(() => ({
  calls: {
    ctor: [] as Array<{ dappName: string; dappUrl?: string; network?: string }>,
    connect: 0,
    disconnect: 0,
    getAccounts: 0,
    signAndExecute: [] as Array<Record<string, unknown>>,
  },
  accounts: { accounts: [{ partyId: 'cantor::alice', holdings: [] }] } as {
    accounts: Array<{ partyId: string; holdings: unknown[] }>;
  },
  discover: true,
  discoveredCount: 0,
}));

vi.mock('@cantor8/wallet-connect-sdk', () => {
  class MockC8WalletProvider {
    constructor(opts: { dappName: string; dappUrl?: string; network?: string }) {
      h.calls.ctor.push(opts);
    }
    connect() {
      h.calls.connect += 1;
      return Promise.resolve();
    }
    disconnect() {
      h.calls.disconnect += 1;
      return Promise.resolve();
    }
    getAccounts() {
      h.calls.getAccounts += 1;
      return Promise.resolve(h.accounts);
    }
    signAndExecute(input: Record<string, unknown>) {
      h.calls.signAndExecute.push(input);
      return Promise.resolve(); // the real SDK returns void
    }
    status() {
      return Promise.resolve({ connected: true });
    }
    on() {
      return () => true;
    }
  }
  return {
    C8WalletProvider: MockC8WalletProvider,
    onC8ProviderDiscovered: (cb: (info: unknown, provider: unknown) => void) => {
      h.discoveredCount += 1;
      if (h.discover) cb({ uuid: 'x', name: 'C8 Wallet', icon: '', rdns: 'tech.cantor8.wallet' }, {});
      return () => {};
    },
    announceC8Provider: () => {},
  };
});

// eslint-disable-next-line import/first
import { Cantor8Adapter } from './cantor8-adapter';

const ctx = (network = 'devnet'): AdapterContext =>
  ({
    appName: 'TestApp',
    origin: 'https://dapp.test',
    network,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  }) as unknown as AdapterContext;

const session = { partyId: 'cantor::alice', walletId: 'cantor8' } as unknown as Session;

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

beforeEach(() => {
  h.calls.ctor = [];
  h.calls.connect = 0;
  h.calls.disconnect = 0;
  h.calls.getAccounts = 0;
  h.calls.signAndExecute = [];
  h.accounts = { accounts: [{ partyId: 'cantor::alice', holdings: [] }] };
  h.discover = true;
  h.discoveredCount = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('Cantor8Adapter: capabilities', () => {
  it('declares no signMessage and no signTransaction (the SDK has neither)', () => {
    const caps = new Cantor8Adapter().getCapabilities();
    expect(caps).toContain('connect');
    expect(caps).toContain('disconnect');
    expect(caps).toContain('submitTransaction');
    expect(caps).toContain('events');
    expect(caps).not.toContain('signMessage');
    expect(caps).not.toContain('signTransaction');
    expect(caps).not.toContain('deeplink');
  });
});

describe('Cantor8Adapter: connect maps party from getAccounts()', () => {
  it('connects, reads partyId from getAccounts(), and passes the network to the SDK', async () => {
    const res = await new Cantor8Adapter().connect(ctx('devnet'));
    expect(h.calls.connect).toBe(1);
    expect(h.calls.getAccounts).toBe(1);
    expect(String(res.partyId)).toBe('cantor::alice');
    expect(h.calls.ctor[0]).toMatchObject({ dappName: 'TestApp', network: 'devnet' });
  });

  it('throws if the wallet returns no account', async () => {
    h.accounts = { accounts: [] };
    await expect(new Cantor8Adapter().connect(ctx('devnet'))).rejects.toThrow();
  });
});

describe('Cantor8Adapter: network guard (devnet/mainnet only)', () => {
  it('rejects testnet before constructing the SDK provider', async () => {
    await expect(new Cantor8Adapter().connect(ctx('testnet'))).rejects.toThrow(/testnet/i);
    expect(h.calls.ctor).toHaveLength(0); // mapNetwork throws before `new C8WalletProvider`
  });
  it('accepts mainnet', async () => {
    await new Cantor8Adapter().connect(ctx('mainnet'));
    expect(h.calls.ctor[0]).toMatchObject({ network: 'mainnet' });
  });
});

describe('Cantor8Adapter: submitTransaction maps to signAndExecute', () => {
  it('passes the signAndExecute input through and returns a receipt keyed on commandId', async () => {
    const adapter = new Cantor8Adapter();
    await adapter.connect(ctx('devnet'));
    const receipt = await adapter.submitTransaction(ctx('devnet'), session, {
      signedTx: {
        note: 'transfer',
        partyId: 'cantor::alice',
        commandId: 'cmd-123',
        commandsJson: '[{"CreateCommand":{}}]',
        disclosedContracts: '',
      },
    });
    expect(h.calls.signAndExecute).toHaveLength(1);
    expect(h.calls.signAndExecute[0]).toMatchObject({
      partyId: 'cantor::alice',
      commandId: 'cmd-123',
      commandsJson: '[{"CreateCommand":{}}]',
    });
    expect(receipt.commandId).toBe('cmd-123');
    expect(String(receipt.transactionHash)).toBe('cmd-123');
  });

  it('rejects a signedTx that is not the SDK signAndExecute shape (no faking)', async () => {
    const adapter = new Cantor8Adapter();
    await adapter.connect(ctx('devnet'));
    await expect(
      adapter.submitTransaction(ctx('devnet'), session, { signedTx: { foo: 'bar' } }),
    ).rejects.toThrow();
    expect(h.calls.signAndExecute).toHaveLength(0);
  });
});

describe('Cantor8Adapter: signMessage fails cleanly (no counterpart in the SDK)', () => {
  it('rejects with a capability error, never resolves, and never routes through signAndExecute', async () => {
    const adapter = new Cantor8Adapter();
    await adapter.connect(ctx('devnet'));
    const result = adapter.signMessage(ctx('devnet'), session, { message: 'hello' });
    await expect(result).rejects.toThrow(/capability|signMessage/i);
    expect(h.calls.signAndExecute).toHaveLength(0); // NOT routed through a tx method
  });
});

describe('Cantor8Adapter: detectInstalled uses the wallet discovery event, not a UA sniff', () => {
  it('reports installed when the wallet announces (even on a DESKTOP user agent)', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120');
    h.discover = true;
    const res = await new Cantor8Adapter().detectInstalled();
    expect(res.installed).toBe(true);
    expect(h.discoveredCount).toBeGreaterThan(0); // it consulted the discovery event
  });

  it('reports NOT installed when nothing announces (even on a MOBILE user agent)', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    h.discover = false;
    const res = await new Cantor8Adapter({ detectTimeoutMs: 20 }).detectInstalled();
    expect(res.installed).toBe(false);
    expect(res.reason).toMatch(/c8#provider_discovery/);
  });
});

describe('Cantor8Adapter: disconnect', () => {
  it('calls the SDK disconnect', async () => {
    const adapter = new Cantor8Adapter();
    await adapter.connect(ctx('devnet'));
    await adapter.disconnect(ctx('devnet'), session);
    expect(h.calls.disconnect).toBe(1);
  });
});
