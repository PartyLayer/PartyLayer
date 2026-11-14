'use client';

import { useCallback, useState } from 'react';
import { PartyLayerProvider, ThemeProvider, PartyLayerLocaleProvider, LanguageSelector, ConnectButton, TokenBalances, darkTheme, lightTheme, type PartyLayerLocale } from '@partylayer/react';
import { TransferForm, TransferInbox, OperationStatus, type OperationPreparationContext, type TransferInboxEntry } from '@partylayer/react/operations';
import type { PartyLayerClient } from '@partylayer/sdk';
import type { SubmitTransactionParams } from '@partylayer/core';
import { createMockWalletClient } from '@partylayer/testing';
import { createProviderBridge } from '@partylayer/provider';

const instrumentId = { admin: 'issuer::preview-only', id: 'DEMO' };
function previewClient() {
  const mock = createMockWalletClient({ connected: true, partyId: 'party::preview-only', network: 'devnet' });
  const provider = createProviderBridge(mock);
  return { ...mock, asProvider: () => provider, listWallets: async () => [],
    async submitTransaction(parameters: SubmitTransactionParams) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { submittedAt: Date.now(), updateId: 'preview-update-only', commandId: (parameters.signedTx as { commandId: string }).commandId };
    },
  } as unknown as PartyLayerClient;
}
const entries: TransferInboxEntry[] = [{ standard: 'v1', reference: { cid: 'preview-offer', instruction: {
  transfer: { sender: 'party::sender-preview', receiver: 'party::preview-only', instrumentId, amount: '25.125',
    requestedAt: '2026-01-01T00:00:00Z', executeBefore: '2099-01-01T00:00:00Z', inputHoldingCids: [] }, status: { kind: 'pendingReceiverAcceptance' },
} } }];

/** Development-only fixtures. No wallet, participant, or asset is contacted. */
export function OperationPreview() {
  const [client] = useState(previewClient);
  const [locale, setLocale] = useState<PartyLayerLocale>('tr');
  const [dark, setDark] = useState(false);
  const prepare = useCallback(async (_input: unknown, context: OperationPreparationContext) => ({
    parameters: { signedTx: { commandId: context.commandId, commands: [{ previewOnly: true }] } }, expiresAt: Date.now() + 60_000,
  }), []);
  const confirm = useCallback(async () => ({ status: 'confirmed' as const, updateId: 'preview-update-only' }), []);
  const theme = dark ? darkTheme : lightTheme;
  return <PartyLayerProvider client={client}><ThemeProvider theme={theme}><PartyLayerLocaleProvider locale={locale}>
    <main style={{ minHeight: '100vh', background: theme.colors.background, color: theme.colors.text, fontFamily: theme.fontFamily, padding: '32px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ padding: 12, marginBottom: 24, borderRadius: 8, background: theme.colors.warningBg, border: `1px solid ${theme.colors.warning}`, fontSize: 13 }}>
          <strong>LOCAL PREVIEW / YEREL ÖNİZLEME</strong> — Örnek veriler kullanılır. Gerçek cüzdan bağlantısı veya işlem yapılmaz.
        </div>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
          <div><div style={{ fontSize: 12, letterSpacing: '.12em', fontWeight: 700, color: theme.colors.textSecondary }}>PARTYLAYER</div>
            <h1 style={{ margin: '8px 0', fontSize: 32 }}>Canton Operation Kit</h1></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <LanguageSelector value={locale} onChange={setLocale} />
            <button onClick={() => setDark(!dark)} style={{ padding: 12, borderRadius: 10, background: theme.colors.surface, color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}>{dark ? 'Light' : 'Dark'}</button>
            <ConnectButton />
          </div>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 24, alignItems: 'start' }}>
          <TransferForm networkId="canton:da-devnet" instrumentId={instrumentId} tokenName="Demo token" prepare={prepare} confirm={confirm} />
          <div>
            <div style={{ padding: 16, border: `1px solid ${theme.colors.border}`, borderRadius: 16, marginBottom: 24 }}>
              <TokenBalances owner="party::preview-only" holdings={[{ cid: 'preview-holding', holding: { account: { owner: 'party::preview-only', provider: 'provider::preview', id: 'Savings' }, amount: '1200.1234567890', instrumentId } }]} />
            </div>
            <TransferInbox networkId="canton:da-devnet" snapshot={{ walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', entries }} prepareAction={prepare} confirm={confirm} />
          </div>
        </div>
        <div style={{ marginTop: 32 }}><OperationStatus transaction={{ id: 'preview-completed-command', walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', commandId: 'preview-command', updateId: 'preview-update-only', status: 'confirmed', createdAt: 1, updatedAt: 2 }}
          outcome={{ sourceId: 'preview-fixture', walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', commandId: 'preview-command', updateId: 'preview-update-only', status: 'pendingReceiverAcceptance' }} /></div>
      </div>
    </main>
  </PartyLayerLocaleProvider></ThemeProvider></PartyLayerProvider>;
}
