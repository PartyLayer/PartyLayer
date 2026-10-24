// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { toPartyId, toWalletId, type Session } from '@partylayer/core';
import { PartyLayerLocaleProvider } from './localization';
import { ConnectButton } from './connect-button';
import { WalletModal } from './modal';
import { CostPreview } from './cost-preview';
import { TransactionToast } from './transaction-toast';
import { SynchronizerSwitcher } from './synchronizer-switcher';

const state = vi.hoisted(() => ({
  session: null as Session | null,
  error: null as Error | null,
  loading: false,
  connect: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('./hooks', () => ({
  useClientSession: () => state.session,
  useWallets: () => ({
    wallets: [
      {
        walletId: 'console',
        name: 'Console Wallet',
        capabilities: ['connect', 'injected'],
        icons: {},
        networks: ['devnet'],
        channel: 'stable',
        metadata: { transport: 'extension' },
      },
    ],
    isLoading: state.loading,
  }),
  useConnect: () => ({
    connect: state.connect,
    error: state.error,
    reset: state.reset,
    isConnecting: false,
  }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
vi.mock('./kit', () => ({
  useWalletIcons: () => ({}),
  useWalletOrder: () => undefined,
  useAttribution: () => undefined,
  resolveWalletIcon: () => null,
}));
beforeEach(() => {
  vi.useFakeTimers();
  state.session = null;
  state.error = null;
  state.loading = false;
  state.connect.mockReset();
  state.reset.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function modal() {
  return <WalletModal isOpen onClose={() => {}} />;
}
function translated(content: React.ReactNode, locale = 'tr-TR', direction: 'ltr' | 'rtl' = 'ltr') {
  return (
    <PartyLayerLocaleProvider locale={locale} direction={direction}>
      {content}
    </PartyLayerLocaleProvider>
  );
}

describe('localized connection UI', () => {
  it('translates labels, accessible names, transport guidance and wallet education', () => {
    render(translated(modal()));
    expect(screen.getByRole('dialog', { name: 'Cüzdan Bağla' }).lang).toBe('tr');
    expect(screen.getByRole('button', { name: 'Kapat' })).not.toBeNull();
    expect(screen.getByText('Tarayıcı eklentisi')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Canton cüzdanlarında yeni misiniz?' }));
    act(() => vi.advanceTimersByTime(130));
    expect(screen.getByText(/Onay ve anahtar yönetimi cüzdanınızda gerçekleşir/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cüzdanları görüntüle' })).not.toBeNull();
  });

  it('translates loading and connection rejection while preserving the wallet name', async () => {
    state.loading = true;
    const view = render(translated(modal()));
    expect(screen.getByText('Cüzdanlar yükleniyor...')).not.toBeNull();
    state.loading = false;
    state.connect.mockResolvedValue(null);
    view.rerender(translated(modal()));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Console Wallet/ })));
    state.error = Object.assign(new Error('external rejection text'), { code: 'USER_REJECTED' });
    view.rerender(translated(modal()));
    act(() => vi.advanceTimersByTime(130));
    expect(screen.getByText('Bağlantı iptal edildi.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).not.toBeNull();
  });

  it('renders translated account actions with RTL layout and unchanged identity', () => {
    state.session = {
      partyId: toPartyId('party::original'),
      walletId: toWalletId('console'),
    } as Session;
    render(translated(<ConnectButton accountStatus="avatar" />, 'tr', 'rtl'));
    fireEvent.click(screen.getByRole('button', { name: 'Hesap party::original' }));
    expect(screen.getByRole('menu', { name: 'Cüzdan hesabı' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Adresi kopyala' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Bağlantıyı kes' })).not.toBeNull();
    expect(screen.getByRole('menu').closest('[dir="rtl"]')).not.toBeNull();
    expect(screen.getByTitle('party::original').textContent).toBe('party::original');
  });

  it('updates labels in place and preserves application-provided custom labels', () => {
    const view = render(translated(<ConnectButton />, 'en-US'));
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).not.toBeNull();
    view.rerender(translated(<ConnectButton />));
    expect(screen.getByRole('button', { name: 'Cüzdan Bağla' })).not.toBeNull();
    view.rerender(translated(<ConnectButton label="App-specific label" />));
    expect(screen.getByRole('button', { name: 'App-specific label' })).not.toBeNull();
  });

  it('falls back to English for unsupported locales and renders deterministically on the server', () => {
    const html = renderToString(translated(<ConnectButton />, 'xx-XX'));
    expect(html).toContain('Connect Wallet');
    expect(html).toContain('lang="en"');
    expect(html).not.toContain('Cüzdan Bağla');
    const turkish = renderToString(translated(<ConnectButton />, 'tr_TR'));
    expect(turkish).toContain('Cüzdan Bağla');
    expect(turkish).toContain('lang="tr"');
  });

  it('translates cost, transaction and synchronizer UI without translating application data', () => {
    render(
      translated(
        <>
          <CostPreview loading error={new Error('vendor detail')} />
          <TransactionToast status="success" />
          <SynchronizerSwitcher
            networkId="canton:da-devnet"
            options={[{ networkId: 'canton:da-devnet', label: 'App network name' }]}
          />
        </>
      )
    );
    expect(screen.getByText('Ücret hesaplanıyor…')).not.toBeNull();
    expect(screen.getByText('Ücret yüklenemedi:').parentElement?.textContent).toBe(
      'Ücret yüklenemedi: vendor detail'
    );
    expect(screen.getByText('İşlem gönderildi')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Senkronizatör' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'App network name' })).not.toBeNull();
  });
});
