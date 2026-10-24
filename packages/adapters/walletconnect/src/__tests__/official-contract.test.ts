// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

describe('reviewed official Canton SDK contract', () => {
  it('constructs the actual lazy runtime without opening a relay connection and exposes the provider/event contract', async () => {
    // No module mock: detect drift in the package we actually install. Do not
    // call connect/restore here; those require a real project and wallet approval.
    const { WalletConnectAdapter } = await import('@canton-network/dapp-sdk');
    const adapter = WalletConnectAdapter.create({ projectId: 'contract-test', chainId: 'canton:da-devnet' });
    expect(adapter.getInfo()).toMatchObject({ name: 'WalletConnect' });
    expect(adapter.provider()).toBe(adapter);
    expect(typeof adapter.restore).toBe('function');
    expect(typeof adapter.request).toBe('function');
    expect(typeof adapter.teardown).toBe('function');
    const listener = vi.fn();
    adapter.on('txChanged', listener);
    adapter.emit('txChanged', { status: 'pending', commandId: 'local-test' });
    expect(listener).toHaveBeenCalledTimes(1);
    adapter.removeListener('txChanged', listener);
    adapter.emit('txChanged', { status: 'executed', commandId: 'local-test' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
