'use client';

/**
 * TransactionToast: a presentational toast showing a transaction's status.
 *
 * Presentational (Model 2, like CostPreview): it receives the status as a PROP and
 * renders it. It does NOT call any hook, does NOT call usePartyLayer, does NOT own
 * the mutation, and does NOT use TanStack Query, so it lives on the MAIN entrypoint,
 * not /query. The consumer derives `status` from a mutation and passes it in, along
 * with the `error` and the optional `receipt`.
 *
 * The submit hooks (`useSubmitTransaction` / `useChoice`) return TanStack mutation
 * state; map it to the `status` prop like this:
 *   status={
 *     mutation.isPending ? 'pending'
 *       : mutation.isSuccess ? 'success'
 *       : mutation.isError ? 'error'
 *       : 'idle'
 *   }
 *   error={mutation.error}
 *   receipt={mutation.data}
 *
 * When `status` is `idle` (or absent), it renders nothing (mirrors CostPreview's
 * empty state).
 *
 * Theme-integrated via `useTheme()` (like CostPreview): the left border accent and
 * the background tint each map to a theme token per status (success, error,
 * neutral), and the text and radius come from the theme.
 */

import { useTheme } from './theme';
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
  message?: React.ReactNode;
  /** Optional transaction receipt, shown on success. */
  receipt?: TxReceipt | null;
  /** Additional CSS class name (applied to the container). */
  className?: string;
  /** Additional inline styles (applied to the container). */
  style?: React.CSSProperties;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export function TransactionToast({
  status = 'idle',
  error = null,
  message,
  receipt = null,
  className,
  style,
}: TransactionToastProps) {
  const theme = useTheme();

  // Render nothing when idle (mirrors CostPreview's empty state).
  if (status === 'idle') {
    return null;
  }

  // Map the status to a theme accent: success and error use their tokens; pending
  // (and any neutral state) uses the secondary text color.
  const accent =
    status === 'success'
      ? theme.colors.success
      : status === 'error'
        ? theme.colors.error
        : theme.colors.textSecondary;

  // Map the status to a background tint, mirroring the accent ternary: success and
  // error use their tint tokens (green, red); pending (and any neutral state) keeps
  // the neutral surface.
  const background =
    status === 'success'
      ? theme.colors.successBg
      : status === 'error'
        ? theme.colors.errorBg
        : theme.colors.surface;

  // The status line text: a custom message overrides the default.
  const defaultText =
    status === 'pending'
      ? 'Submitting transaction...'
      : status === 'success'
        ? 'Transaction submitted'
        : `Transaction failed: ${error?.message ?? 'unknown error'}`;

  const detail =
    status === 'success' && receipt
      ? receipt.updateId ??
        receipt.commandId ??
        // `transactionHash` is optional, so stringify it only when it exists —
        // otherwise this line renders the word "undefined" to the user.
        (receipt.transactionHash === undefined ? null : String(receipt.transactionHash))
      : null;

  return (
    <div
      className={className}
      role={status === 'error' ? 'alert' : 'status'}
      data-status={status}
      style={{
        borderLeft: `3px solid ${accent}`,
        borderRadius: theme.borderRadius,
        padding: '10px 12px',
        fontSize: '13px',
        fontFamily: theme.fontFamily,
        color: theme.colors.text,
        backgroundColor: background,
        ...style,
      }}
    >
      <div aria-live={status === 'error' ? 'assertive' : 'polite'} style={{ fontWeight: 600 }}>
        {message ?? defaultText}
      </div>

      {detail != null && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            fontFamily: MONO,
            color: theme.colors.textSecondary,
            wordBreak: 'break-all',
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
