import type { TransactionToastStatus } from '@partylayer/react';

/**
 * Map a TanStack mutation's flags to the `TransactionToast` status prop. This is
 * the documented mapping the toast's JSDoc describes: pending, success, error, else
 * idle. Presentational: the toast renders whatever status the dApp derives here.
 */
export function toastStatus(m: {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}): TransactionToastStatus {
  if (m.isPending) return 'pending';
  if (m.isSuccess) return 'success';
  if (m.isError) return 'error';
  return 'idle';
}
