// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { toPartyId, toWalletId, type Session } from '@partylayer/core';
import { PartyLayerLocaleProvider, useLocale } from './localization';
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
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function CurrentLocale() { const { locale } = useLocale(); return <span data-testid="locale">{locale}</span>; }

describe('browser language defaults', () => {
  it('chooses the first supported browser preference and keeps server output English', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zz-ZZ', 'zh-Hant', 'tr-TR', 'en']);
    const tree = <PartyLayerLocaleProvider><CurrentLocale /></PartyLayerLocaleProvider>;
    expect(renderToString(tree)).toContain('>en<');
    render(tree);
    expect(screen.getByTestId('locale').textContent).toBe('tr');
  });
  it('honors explicit application choices and English browser preference', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'tr']);
    const view = render(<PartyLayerLocaleProvider><CurrentLocale /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    view.rerender(<PartyLayerLocaleProvider locale="tr"><CurrentLocale /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('tr');
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect(screen.getByTestId('locale').textContent).toBe('tr');
    view.rerender(<PartyLayerLocaleProvider locale="unsupported"><CurrentLocale /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });
  it('falls back to English if browser preferences are unsupported or inaccessible', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zz', 'zh-TW']);
    render(<PartyLayerLocaleProvider><CurrentLocale /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    languages.mockImplementation(() => { throw new Error('Browser settings unavailable'); });
    act(() => window.dispatchEvent(new Event('languagechange')));
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });
  it('uses navigator.language if the preferences list is empty', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('tr_TR');
    render(<PartyLayerLocaleProvider><CurrentLocale /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('tr');
  });
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
