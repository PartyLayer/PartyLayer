// @vitest-environment happy-dom
/**
 * TransactionToast tests (@vue/test-utils): a presentational status toast. It receives
 * the status as a prop and renders it; the consumer owns the mutation. Covers: renders
 * nothing for idle/absent, the pending/success/error states, the receipt detail on
 * success, and a custom message override.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { TxReceipt } from '@partylayer/core';
import { TransactionToast } from '../transaction-toast';

describe('TransactionToast', () => {
  it('renders nothing when idle (or absent)', () => {
    expect(mount(TransactionToast, { props: { status: 'idle' } }).find('.pl-transaction-toast').exists()).toBe(false);
    expect(mount(TransactionToast, { props: {} }).text()).toBe('');
  });

  it('shows a pending state', () => {
    const w = mount(TransactionToast, { props: { status: 'pending' } });
    expect(w.find('.pl-transaction-toast').attributes('data-status')).toBe('pending');
    expect(w.text()).toContain('Submitting transaction');
  });

  it('shows a success state with the receipt detail', () => {
    const receipt: TxReceipt = {
      transactionHash: '0xtx' as TxReceipt['transactionHash'],
      submittedAt: 1,
      updateId: '1220abc',
    };
    const w = mount(TransactionToast, { props: { status: 'success', receipt } });
    expect(w.find('.pl-transaction-toast').attributes('data-status')).toBe('success');
    expect(w.text()).toContain('Transaction submitted');
    expect(w.text()).toContain('1220abc'); // receipt detail (updateId)
  });

  it('shows an error state with the error message', () => {
    const w = mount(TransactionToast, { props: { status: 'error', error: new Error('submit failed') } });
    expect(w.find('.pl-transaction-toast').attributes('data-status')).toBe('error');
    expect(w.text()).toContain('Transaction failed');
    expect(w.text()).toContain('submit failed');
  });

  it('uses a custom message when provided (overrides default text)', () => {
    const w = mount(TransactionToast, { props: { status: 'pending', message: 'Hang tight' } });
    expect(w.text()).toContain('Hang tight');
    expect(w.text()).not.toContain('Submitting transaction');
  });
});
