// @vitest-environment jsdom
import React, { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { toPartyId, toWalletId, type Session } from '@partylayer/core';
import { ConnectButton } from './connect-button';
import { WalletModal } from './modal';
import { useDialogFocus } from './dialog-focus';

const state = vi.hoisted(() => ({ session: null as Session | null, disconnect: vi.fn() }));
vi.mock('./hooks', () => ({
  useClientSession: () => state.session,
  useWallets: () => ({ wallets: [], isLoading: false }),
  useConnect: () => ({ connect: vi.fn(), error: null, reset: vi.fn(), isConnecting: false }),
  useDisconnect: () => ({ disconnect: state.disconnect }),
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
  state.disconnect.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ModalHarness({ hide = false }: { hide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open wallets</button>
      <input aria-label="Vendor approval" />
      <WalletModal isOpen={open && !hide} onClose={() => setOpen(false)} />
    </>
  );
}
function openDialog() {
  const opener = screen.getByRole('button', { name: 'Open wallets' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}
function connected() {
  state.session = {
    partyId: toPartyId('party::keyboard'),
    walletId: toWalletId('console'),
  } as Session;
}

describe('wallet dialog keyboard lifecycle', () => {
  it('moves focus inside, wraps Tab in both directions, and returns focus after Escape', () => {
    render(
      <StrictMode>
        <ModalHarness />
      </StrictMode>
    );
    const opener = openDialog();
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('link', { name: 'Powered by PartyLayer' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(160));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('does not intercept Escape or restore focus over a separate vendor approval surface', () => {
    const view = render(<ModalHarness />);
    openDialog();
    const vendor = screen.getByRole('textbox', { name: 'Vendor approval' });
    vendor.focus();
    fireEvent.keyDown(vendor, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    // The parent can hide our dialog while the vendor UI remains focused.
    view.rerender(<ModalHarness hide />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Vendor approval' }));
  });

  it('recovers focus after an animated view replaces the focused control', () => {
    // The education view is available when at least one wallet is listed; test
    // the shared focus behavior directly with a changing panel instead.
    const { rerender } = render(<FocusHarness view="first" />);
    expect(document.activeElement?.textContent).toBe('first');
    rerender(<FocusHarness view="second" />);
    expect(document.activeElement?.textContent).toBe('second');
  });
});

function FocusHarness({ view }: { view: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, view, () => {});
  return (
    <div ref={ref} tabIndex={-1}>
      <button key={view}>{view}</button>
    </div>
  );
}

describe('connected account menu', () => {
  it('shows the actual network and wallet-side recovery for a mismatched connection', () => {
    connected();
    state.session = { ...state.session!, network: 'mainnet',
      networkMismatch: { expected: 'canton:da-devnet', actual: 'canton:da-mainnet' } };
    render(<ConnectButton />);
    const trigger = screen.getByRole('button', { name: 'Wrong network' });
    fireEvent.click(trigger);
    expect(screen.getByText('Network: Mainnet')).not.toBeNull();
    expect(screen.getByText('Switch to Devnet in your wallet, then reconnect.')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Disconnect' })).not.toBeNull();
  });
  it('supports arrow navigation, Home/End and Escape with focus returning to the trigger', () => {
    connected();
    render(<ConnectButton accountStatus="avatar" />);
    const trigger = screen.getByRole('button', { name: 'Account party::keyboard' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const copy = screen.getByRole('menuitem', { name: 'Copy address' });
    const disconnect = screen.getByRole('menuitem', { name: 'Disconnect' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu').id).toBe(trigger.getAttribute('aria-controls'));
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(disconnect);
    fireEvent.keyDown(disconnect, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: 'End' });
    expect(document.activeElement).toBe(disconnect);
    fireEvent.keyDown(disconnect, { key: 'Home' });
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens at the last action with ArrowUp and exits normally with Tab', () => {
    connected();
    render(<ConnectButton accountStatus="avatar" />);
    const trigger = screen.getByRole('button', { name: 'Account party::keyboard' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    const disconnect = screen.getByRole('menuitem', { name: 'Disconnect' });
    expect(document.activeElement).toBe(disconnect);
    expect(fireEvent.keyDown(disconnect, { key: 'Tab' })).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on focus leaving and does not steal the new focus', () => {
    connected();
    render(
      <>
        <ConnectButton />
        <button>Next action</button>
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'party::keyboard' }));
    const next = screen.getByRole('button', { name: 'Next action' });
    act(() => next.focus());
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(next);
  });

  it('preserves focus when disconnect replaces the connected button', async () => {
    connected();
    const view = render(<ConnectButton />);
    fireEvent.click(screen.getByRole('button', { name: 'party::keyboard' }));
    await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnect' })));
    expect(state.disconnect).toHaveBeenCalledOnce();
    state.session = null;
    view.rerender(<ConnectButton />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Connect Wallet' }));
  });

  it('does not expose a menu when account actions are disabled', () => {
    connected();
    render(<ConnectButton showDisconnect={false} accountStatus="avatar" />);
    const trigger = screen.getByRole('button', { name: 'Account party::keyboard' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('does not submit its embedding application form', () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <ConnectButton />
      </form>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }));
    expect(submit).not.toHaveBeenCalled();
  });
});
