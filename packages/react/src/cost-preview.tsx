'use client';

/**
 * CostPreview: a presentational traffic-cost panel for Canton dApps.
 *
 * RainbowKit-style sibling to ConnectButton: it receives cost data as PROPS and
 * renders it. It does NOT call any hook, does NOT call usePartyLayer, does NOT
 * reach any ledger/validator, and does NOT use TanStack Query, so it lives on the
 * MAIN entrypoint, not /query. The dApp calls `useTransactionCostEstimate` /
 * `usePaidTrafficCost` itself and passes the results in. A thin UX layer over the
 * cost fields the dApp already has (Model 2).
 *
 * Costs are int64-as-string (`TrafficCost`); by default the raw value is shown
 * verbatim (no invented unit/conversion). Pass `formatCost` to render your own
 * representation (e.g. convert to CC).
 */

import { useTheme } from './theme';
import type { CostEstimation, PaidTrafficCost, TrafficCost } from '@partylayer/core';

export interface CostPreviewProps {
  /** Pre-submission estimate. Its three cost fields are int64-as-string. */
  estimate?: CostEstimation | null;
  /** Post-execution ACTUAL paid cost (optional; int64-as-string). */
  paid?: PaidTrafficCost | null;
  /** Show a loading state while the dApp's fetcher is in flight. */
  loading?: boolean;
  /** Show an error state (e.g. the fetcher rejected). */
  error?: Error | null;
  /**
   * Optional value formatter (e.g. convert to CC). When omitted, the raw int64
   * string is rendered as-is, no invented unit or conversion.
   */
  formatCost?: (cost: TrafficCost) => React.ReactNode;
  /** Additional CSS class name (applied to the container). */
  className?: string;
  /** Additional inline styles (applied to the container). */
  style?: React.CSSProperties;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export function CostPreview({
  estimate,
  paid,
  loading,
  error,
  formatCost,
  className,
  style,
}: CostPreviewProps) {
  const theme = useTheme();

  const hasEstimate = estimate != null;
  const hasPaid = paid != null;

  // An empty UX layer shouldn't show an empty card.
  if (!hasEstimate && !hasPaid && !loading && !error) {
    return null;
  }

  const renderCost = (cost: TrafficCost): React.ReactNode =>
    formatCost ? formatCost(cost) : String(cost);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '16px',
    margin: 0,
    padding: '4px 0',
  };
  const dividerRow: React.CSSProperties = {
    ...rowStyle,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '4px',
    paddingTop: '8px',
  };
  const labelStyle: React.CSSProperties = { color: theme.colors.textSecondary, margin: 0 };
  const valueStyle: React.CSSProperties = {
    color: theme.colors.text,
    margin: 0,
    fontFamily: MONO,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius,
        padding: '12px 14px',
        fontFamily: theme.fontFamily,
        color: theme.colors.text,
        fontSize: '13px',
        ...style,
      }}
    >
      {loading && (
        <div aria-live="polite" style={{ color: theme.colors.textSecondary, padding: '2px 0' }}>
          Estimating cost…
        </div>
      )}

      {error && (
        <div
          aria-live="polite"
          style={{
            color: theme.colors.error,
            backgroundColor: theme.colors.errorBg,
            borderRadius: theme.borderRadius,
            padding: '8px 10px',
          }}
        >
          Couldn’t load the cost: {error.message}
        </div>
      )}

      {(hasEstimate || hasPaid) && (
        <dl style={{ margin: 0 }}>
          {hasEstimate && (
            <>
              <div style={rowStyle}>
                <dt style={labelStyle}>Confirmation request</dt>
                <dd style={valueStyle}>
                  {renderCost(estimate!.confirmationRequestTrafficCostEstimation)}
                </dd>
              </div>
              <div style={rowStyle}>
                <dt style={labelStyle}>Confirmation response</dt>
                <dd style={valueStyle}>
                  {renderCost(estimate!.confirmationResponseTrafficCostEstimation)}
                </dd>
              </div>
              <div style={dividerRow}>
                <dt
                  style={{
                    ...labelStyle,
                    color: theme.colors.text,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {/* Thin brand accent, never used as readable text. */}
                  <span
                    aria-hidden="true"
                    style={{
                      width: '3px',
                      height: '12px',
                      borderRadius: '2px',
                      backgroundColor: theme.colors.primary,
                      display: 'inline-block',
                    }}
                  />
                  Total
                </dt>
                <dd style={{ ...valueStyle, fontWeight: 700 }}>
                  {renderCost(estimate!.totalTrafficCostEstimation)}
                </dd>
              </div>
            </>
          )}

          {hasPaid && (
            <div style={hasEstimate ? dividerRow : rowStyle}>
              <dt style={labelStyle}>Actual paid</dt>
              <dd style={{ ...valueStyle, color: theme.colors.success, fontWeight: 600 }}>
                {renderCost(paid!)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
