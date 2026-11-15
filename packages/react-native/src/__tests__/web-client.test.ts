import { describe, it, expect } from 'vitest';
import { PartyLayerClient as SDKBrowserClient } from '@partylayer/sdk';
import { createReactNativeClient, PartyLayerClient } from '../client.web';
import { toWalletId } from '@partylayer/core';

describe('React Native Web factory', () => {
  it('preserves the browser SDK default catalog and constructor identity', () => {
    const client = createReactNativeClient({ network: 'devnet', app: { name: 'Web fixture' }, deferInitialization: true });
    try {
      expect(client).toBeInstanceOf(SDKBrowserClient);
      expect(client).toBeInstanceOf(PartyLayerClient);
      expect(client.getAdapter(toWalletId('loop'))).toBeDefined();
      expect(client.getAdapter(toWalletId('cantor8'))).toBeDefined();
    } finally { client.destroy(); }
  });
  it('retains automatic browser configuration and explicit storage precedence', async () => {
    let reads = 0;
    const storage = { get: async () => { reads++; return null; }, set: async () => {}, remove: async () => {}, clear: async () => {} };
    const client = createReactNativeClient({ network: 'devnet', app: { name: 'Web fixture' }, walletConnect: { projectId: 'configured-test-project' }, storage, deferInitialization: true });
    try { await client.getActiveSession(); expect(reads).toBeGreaterThan(0); } finally { client.destroy(); }
  });
});
