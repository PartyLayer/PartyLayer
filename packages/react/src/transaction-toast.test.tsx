// @vitest-environment jsdom
/**
 * TransactionToast tests (@testing-library/react): a presentational status toast. It
 * receives the status as a prop and renders it; the consumer owns the mutation.
 * Ported from the Vue reference. Covers: renders nothing for idle/absent, the
 * pending/success/error states, the receipt detail on success, and a custom message
 * override. Rendered within a ThemeProvider so the theme tokens resolve.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { TxReceipt } from '@partylayer/core';
import { TransactionToast } from './transaction-toast';
import { ThemeProvider, lightTheme } from './theme';

function renderToast(ui: React.ReactElement) {
  return render(<ThemeProvider theme="light">{ui}</ThemeProvider>);
}

// jsdom normalizes an inline color to its rgb(...) form; push a theme token through
// the same path so background assertions compare against the theme value (not a
// hardcoded hex) and survive jsdom's normalization.
function normalizeColor(value: string): string {
  const el = document.createElement('div');
  el.style.backgroundColor = value;
  return el.style.backgroundColor;
}

describe('TransactionToast', () => {
  it('renders nothing when idle (or absent)', () => {
    expect(renderToast(<TransactionToast status="idle" />).container.querySelector('[role="status"]')).toBeNull();
    expect(renderToast(<TransactionToast />).container.textContent).toBe('');
  });

  it('shows a pending state', () => {
    const { container } = renderToast(<TransactionToast status="pending" />);
    const root = container.querySelector('[role="status"]') as HTMLElement;
    expect(root.getAttribute('data-status')).toBe('pending');
    expect(root.textContent).toContain('Submitting transaction');
  });

  it('shows a success state with the receipt detail', () => {
    const receipt: TxReceipt = {
      transactionHash: '0xtx' as TxReceipt['transactionHash'],
      submittedAt: 1,
      updateId: '1220abc',
    };
    const { container } = renderToast(<TransactionToast status="success" receipt={receipt} />);
    const root = container.querySelector('[role="status"]') as HTMLElement;
    expect(root.getAttribute('data-status')).toBe('success');
    expect(root.textContent).toContain('Transaction submitted');
    expect(root.textContent).toContain('1220abc'); // receipt detail (updateId)
  });

  it('falls back to commandId then transactionHash for the receipt detail', () => {
    const withCommand: TxReceipt = {
      transactionHash: '0xtx' as TxReceipt['transactionHash'],
      submittedAt: 1,
      commandId: 'cmd-42',
    };
    expect(
      renderToast(<TransactionToast status="success" receipt={withCommand} />).container.textContent,
    ).toContain('cmd-42');

    const hashOnly: TxReceipt = {
      transactionHash: '0xhashonly' as TxReceipt['transactionHash'],
      submittedAt: 1,
    };
    expect(
      renderToast(<TransactionToast status="success" receipt={hashOnly} />).container.textContent,
    ).toContain('0xhashonly');
  });

  it('shows an error state with the error message', () => {
    const { container } = renderToast(<TransactionToast status="error" error={new Error('submit failed')} />);
    const root = container.querySelector('[data-status="error"]') as HTMLElement;
    expect(root.getAttribute('data-status')).toBe('error');
    expect(root.textContent).toContain('Transaction failed');
    expect(root.textContent).toContain('submit failed');
  });

  it('uses a custom message when provided (overrides default text)', () => {
    const { container } = renderToast(<TransactionToast status="pending" message="Hang tight" />);
    expect(container.textContent).toContain('Hang tight');
    expect(container.textContent).not.toContain('Submitting transaction');
  });

  it('exposes the status line as an aria-live region', () => {
    const { container } = renderToast(<TransactionToast status="pending" />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('Submitting transaction');
  });

  it('maps each status to a distinct theme accent on the left border', () => {
    const accentFor = (status: 'pending' | 'success' | 'error') => {
      const { container } = render(
        <ThemeProvider theme="dark">
          <TransactionToast status={status} />
        </ThemeProvider>,
      );
      return (container.querySelector(`[data-status="${status}"]`) as HTMLElement).style.borderLeftColor;
    };
    // success -> theme.colors.success, error -> theme.colors.error, pending -> neutral.
    // Assert on the parsed color so jsdom's hex-to-rgb normalization does not matter,
    // and that the three map to three different theme tokens.
    const success = accentFor('success');
    const error = accentFor('error');
    const pending = accentFor('pending');
    expect(new Set([success, error, pending]).size).toBe(3);
    expect(success).not.toBe('');
  });

  it('renders role alert and the error background tint (not the neutral surface) for an error', () => {
    const { container } = renderToast(<TransactionToast status="error" error={new Error('boom')} />);
    const root = container.querySelector('[data-status="error"]') as HTMLElement;
    expect(root.getAttribute('role')).toBe('alert');
    expect(root.style.backgroundColor).toBe(normalizeColor(lightTheme.colors.errorBg));
    expect(root.style.backgroundColor).not.toBe(normalizeColor(lightTheme.colors.surface));
    // The failure is announced assertively rather than politely.
    expect(container.querySelector('[aria-live="assertive"]')?.textContent).toContain('Transaction failed');
  });

  it('renders role status and the success background tint (not the neutral surface) for a success', () => {
    const { container } = renderToast(<TransactionToast status="success" />);
    const root = container.querySelector('[data-status="success"]') as HTMLElement;
    expect(root.getAttribute('role')).toBe('status');
    expect(root.style.backgroundColor).toBe(normalizeColor(lightTheme.colors.successBg));
    expect(root.style.backgroundColor).not.toBe(normalizeColor(lightTheme.colors.surface));
  });

  it('renders role status and the neutral surface background for pending', () => {
    const { container } = renderToast(<TransactionToast status="pending" />);
    const root = container.querySelector('[data-status="pending"]') as HTMLElement;
    expect(root.getAttribute('role')).toBe('status');
    expect(root.style.backgroundColor).toBe(normalizeColor(lightTheme.colors.surface));
  });
});
