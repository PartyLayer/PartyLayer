/**
 * TransactionToast: a presentational toast showing a transaction's status.
 *
 * Presentational (Model 2, like CostPreview): it receives the status as a PROP and
 * renders it. It does NOT call any composable, does NOT inject the session store, and
 * does NOT own the mutation. The consumer derives `status` from a mutation
 * (e.g. `useChoice` / a submit composable: `isPending`/`isSuccess`/`isError`) and
 * passes it in, along with the `error` and the optional `receipt`.
 *
 * When `status` is `idle` (or absent), it renders nothing (mirrors CostPreview's
 * empty state).
 *
 * Authored with `defineComponent` + `h` (no `.vue` SFC, no theme system), like
 * CostPreview. Theme-independent minimal styles (a neutral colored accent per
 * status); a consumer styles the root via `class`/`style`, applied by Vue attribute
 * fallthrough.
 */
import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
import type { TxReceipt } from '@partylayer/core';

export type TransactionToastStatus = 'idle' | 'pending' | 'success' | 'error';

export interface TransactionToastProps {
  /**
   * The transaction status. The consumer derives this from a mutation's
   * `isPending`/`isSuccess`/`isError`. `idle` (or absent) renders nothing.
   */
  status?: TransactionToastStatus;
  /** The error when `status` is `error`. */
  error?: Error | null;
  /** Optional custom message, shown instead of the default status text. */
  message?: string | VNodeChild;
  /** Optional transaction receipt, shown on success. */
  receipt?: TxReceipt | null;
}

const ACCENT: Record<Exclude<TransactionToastStatus, 'idle'>, string> = {
  pending: '#555555',
  success: '#0a7d33',
  error: '#b00020',
};

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const TransactionToast = defineComponent({
  name: 'TransactionToast',
  props: {
    status: { type: String as PropType<TransactionToastStatus>, default: 'idle' },
    error: { type: Object as PropType<Error | null>, default: null },
    message: { type: [String, Object, Array, Number, Boolean] as PropType<string | VNodeChild>, default: undefined },
    receipt: { type: Object as PropType<TxReceipt | null>, default: null },
  },
  setup(props) {
    return () => {
      const status = props.status;
      // Render nothing when idle (mirrors CostPreview's empty state).
      if (status === 'idle') {
        return null;
      }

      const accent = ACCENT[status];
      const children: VNodeChild[] = [];

      // The status line: a custom message overrides the default text.
      const defaultText =
        status === 'pending'
          ? 'Submitting transaction...'
          : status === 'success'
            ? 'Transaction submitted'
            : `Transaction failed: ${props.error?.message ?? 'unknown error'}`;

      children.push(
        h('div', { 'aria-live': 'polite', style: { fontWeight: 600 } }, [props.message ?? defaultText]),
      );

      // On success, show the receipt's identifying fields when provided.
      if (status === 'success' && props.receipt) {
        const receipt = props.receipt;
        const detail = receipt.updateId ?? receipt.commandId ?? String(receipt.transactionHash);
        children.push(
          h(
            'div',
            { style: { marginTop: '4px', fontSize: '12px', fontFamily: MONO, color: '#555555', wordBreak: 'break-all' } },
            detail,
          ),
        );
      }

      return h(
        'div',
        {
          class: 'pl-transaction-toast',
          role: 'status',
          'data-status': status,
          style: {
            borderLeft: `3px solid ${accent}`,
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '13px',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
            color: 'inherit',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          },
        },
        children,
      );
    };
  },
});
