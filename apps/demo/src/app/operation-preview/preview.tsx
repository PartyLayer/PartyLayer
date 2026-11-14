'use client';

import { useCallback, useEffect, useState } from 'react';
import { PartyLayerProvider, ThemeProvider, PartyLayerLocaleProvider, LanguageSelector, ConnectButton, TokenBalances, darkTheme, lightTheme, usePartyLayerLocale, type PartyLayerLocale } from '@partylayer/react';
import { TransferForm, TransferInbox, OperationStatus, type OperationPreparationContext, type TransferInboxEntry } from '@partylayer/react/operations';
import type { PartyLayerClient } from '@partylayer/sdk';
import type { SubmitTransactionParams } from '@partylayer/core';
import { createMockWalletClient } from '@partylayer/testing';
import { createProviderBridge } from '@partylayer/provider';

const instrumentId = { admin: 'issuer::preview-only', id: 'DEMO' };
function PreviewLanguage({ onChange }: { onChange: (locale: PartyLayerLocale) => void }) {
  const { locale } = usePartyLayerLocale();
  return <LanguageSelector value={locale} onChange={onChange} />;
}
function PreviewNotice() {
  const { locale } = usePartyLayerLocale();
  return <><strong style={{ fontSize: 10, letterSpacing: '.09em', whiteSpace: 'nowrap' }}>LOCAL PREVIEW</strong>
    <span>{locale === 'tr' ? 'Örnek veriler. Gerçek cüzdan bağlantısı veya işlem yapılmaz.' : 'Sample data. No real wallet connection or transaction.'}</span></>;
}
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
const entries = (asset = instrumentId, sender = 'party::sender-preview'): TransferInboxEntry[] => [{ standard: 'v1', reference: { cid: 'preview-offer', instruction: {
  transfer: { sender, receiver: 'party::preview-only', instrumentId: asset, amount: '25.125',
    requestedAt: '2026-01-01T00:00:00Z', executeBefore: '2099-01-01T00:00:00Z', inputHoldingCids: [] }, status: { kind: 'pendingReceiverAcceptance' },
} } }];

/** Development-only fixtures. No wallet, participant, or asset is contacted. */
export function OperationPreview() {
  const [client] = useState(previewClient);
  const [locale, setLocale] = useState<PartyLayerLocale>();
  const [dark, setDark] = useState(false);
  const [stress, setStress] = useState(false);
  useEffect(() => { setStress(new URLSearchParams(window.location.search).get('stress') === '1'); }, []);
  const asset = stress ? { admin: `issuer::${'a'.repeat(180)}`, id: `DEMO-${'ASSET'.repeat(24)}` } : instrumentId;
  const prepare = useCallback(async (_input: unknown, context: OperationPreparationContext) => ({
    parameters: { signedTx: { commandId: context.commandId, commands: [{ previewOnly: true }] } }, expiresAt: Date.now() + 60_000,
  }), []);
  const confirm = useCallback(async () => ({ status: 'confirmed' as const, updateId: 'preview-update-only' }), []);
  const theme = dark ? darkTheme : lightTheme;
  return <PartyLayerProvider client={client}><ThemeProvider theme={theme}><PartyLayerLocaleProvider locale={locale}>
    <main style={{ boxSizing: 'border-box', minHeight: '100vh', background: theme.colors.surface, color: theme.colors.text, fontFamily: theme.fontFamily, lineHeight: 1.5, padding: 'clamp(20px, 4vw, 48px) clamp(12px, 3vw, 32px)', overflowWrap: 'anywhere' }}>
      <div style={{ maxWidth: 1080, minWidth: 0, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', padding: '10px 14px', marginBottom: 28, borderRadius: 10, background: theme.colors.warningBg, border: `1px solid ${theme.colors.border}`, fontSize: 12 }}>
          <PreviewNotice />
        </div>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 32, minWidth: 0 }}>
          <div><div style={{ fontSize: 12, letterSpacing: '.12em', fontWeight: 700, color: theme.colors.textSecondary }}>PARTYLAYER</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(24px, 4vw, 30px)', letterSpacing: '-.035em', lineHeight: 1.2 }}>Canton Operation Kit</h1></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
            <PreviewLanguage onChange={setLocale} />
            <button onClick={() => setDark(!dark)} style={{ padding: 12, borderRadius: 10, background: theme.colors.surface, color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}>{dark ? 'Light' : 'Dark'}</button>
            <ConnectButton />
          </div>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 24, alignItems: 'start', minWidth: 0 }}>
          <TransferForm networkId="canton:da-devnet" instrumentId={asset} tokenName="Demo token" prepare={prepare} confirm={confirm} />
          <div style={{ display: 'grid', gap: 24, minWidth: 0 }}>
            <div style={{ padding: 8, minWidth: 0, background: theme.colors.background, border: `1px solid ${theme.colors.border}`, borderRadius: 20 }}>
              <TokenBalances owner="party::preview-only" holdings={[{ cid: 'preview-holding', holding: { account: { owner: 'party::preview-only', provider: stress ? `provider::${'p'.repeat(180)}` : 'provider::preview', id: stress ? 'Savings'.repeat(32) : 'Savings' }, amount: stress ? '9999999999999999999999999999.1234567890' : '1200.1234567890', instrumentId: asset } }]} />
            </div>
            <TransferInbox networkId="canton:da-devnet" snapshot={{ walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', entries: entries(asset, stress ? `party::${'s'.repeat(180)}` : undefined) }} prepareAction={prepare} confirm={confirm} />
          </div>
        </div>
        <div style={{ marginTop: 32 }}><OperationStatus transaction={{ id: 'preview-completed-command', walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', commandId: 'preview-command', updateId: 'preview-update-only', status: 'confirmed', createdAt: 1, updatedAt: 2 }}
          outcome={{ sourceId: 'preview-fixture', walletId: 'mock', partyId: 'party::preview-only', networkId: 'canton:da-devnet', commandId: 'preview-command', updateId: 'preview-update-only', status: 'pendingReceiverAcceptance' }} /></div>
      </div>
    </main>
  </PartyLayerLocaleProvider></ThemeProvider></PartyLayerProvider>;
}
