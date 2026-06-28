/**
 * CostPreview: a presentational traffic-cost panel for Canton dApps, the Vue mirror
 * of React's CostPreview.
 *
 * It receives cost data as PROPS and renders it. It does NOT call any composable,
 * does NOT inject the session store, does NOT reach any ledger/validator, and does
 * NOT use vue-query. The dApp calls `useTransactionCostEstimate` /
 * `usePaidTrafficCost` itself and passes the results in. A thin UX layer over the
 * cost fields the dApp already has (Model 2).
 *
 * Costs are int64-as-string (`TrafficCost`); by default the raw value is rendered
 * verbatim (no invented unit or conversion). Pass `formatCost` to render your own
 * representation (e.g. convert to CC).
 *
 * Authored with `defineComponent` + `h` (a render function), not a `.vue` SFC, so it
 * builds with the package's tsup pipeline (which does not compile SFCs). This
 * matches the package's existing component style.
 *
 * Theme-independent: the Vue package has no theme system, so this uses minimal
 * neutral inline styles plus a `pl-cost-preview` root class. A consumer styles the
 * container by passing `class`/`style`, which Vue applies to the root element via
 * attribute fallthrough (no explicit className/style props needed).
 */
import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
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
  formatCost?: (cost: TrafficCost) => VNodeChild;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const BORDER = '1px solid #e5e7eb';

const containerStyle = {
  border: BORDER,
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
} as const;
const rowStyle = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '16px',
  margin: '0',
  padding: '4px 0',
} as const;
const dividerRowStyle = {
  ...rowStyle,
  borderTop: BORDER,
  marginTop: '4px',
  paddingTop: '8px',
} as const;
const labelStyle = { color: '#555555', margin: '0' } as const;
const valueStyle = {
  color: 'inherit',
  margin: '0',
  fontFamily: MONO,
  fontVariantNumeric: 'tabular-nums',
} as const;

export const CostPreview = defineComponent({
  name: 'CostPreview',
  props: {
    estimate: { type: Object as PropType<CostEstimation | null>, default: null },
    // TrafficCost is a branded string; String is the runtime validator, cast
    // through unknown for the brand.
    paid: { type: String as unknown as PropType<PaidTrafficCost | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: Object as PropType<Error | null>, default: null },
    formatCost: { type: Function as PropType<(cost: TrafficCost) => VNodeChild>, default: undefined },
  },
  setup(props) {
    return () => {
      const hasEstimate = props.estimate != null;
      const hasPaid = props.paid != null;

      // An empty UX layer should not show an empty card.
      if (!hasEstimate && !hasPaid && !props.loading && !props.error) {
        return null;
      }

      const renderCost = (cost: TrafficCost): VNodeChild =>
        props.formatCost ? props.formatCost(cost) : String(cost);

      const children: VNodeChild[] = [];

      if (props.loading) {
        children.push(
          h('div', { 'aria-live': 'polite', style: { color: '#555555', padding: '2px 0' } }, 'Estimating cost...'),
        );
      }

      if (props.error) {
        children.push(
          h(
            'div',
            {
              'aria-live': 'polite',
              style: { color: '#b00020', borderRadius: '8px', padding: '8px 10px' },
            },
            `Could not load the cost: ${props.error.message}`,
          ),
        );
      }

      if (hasEstimate || hasPaid) {
        const rows: VNodeChild[] = [];

        if (hasEstimate) {
          const estimate = props.estimate as CostEstimation;
          rows.push(
            h('div', { style: rowStyle }, [
              h('dt', { style: labelStyle }, 'Confirmation request'),
              h('dd', { style: valueStyle }, [renderCost(estimate.confirmationRequestTrafficCostEstimation)]),
            ]),
            h('div', { style: rowStyle }, [
              h('dt', { style: labelStyle }, 'Confirmation response'),
              h('dd', { style: valueStyle }, [renderCost(estimate.confirmationResponseTrafficCostEstimation)]),
            ]),
            h('div', { style: dividerRowStyle }, [
              h('dt', { style: { ...labelStyle, color: 'inherit', fontWeight: 600 } }, 'Total'),
              h('dd', { style: { ...valueStyle, fontWeight: 700 } }, [
                renderCost(estimate.totalTrafficCostEstimation),
              ]),
            ]),
          );
        }

        if (hasPaid) {
          rows.push(
            h('div', { style: hasEstimate ? dividerRowStyle : rowStyle }, [
              h('dt', { style: labelStyle }, 'Actual paid'),
              h('dd', { style: { ...valueStyle, color: '#0a7d33', fontWeight: 600 } }, [
                renderCost(props.paid as PaidTrafficCost),
              ]),
            ]),
          );
        }

        children.push(h('dl', { style: { margin: '0' } }, rows));
      }

      // Consumer class/style fall through to this root via Vue attribute inheritance.
      return h('div', { class: 'pl-cost-preview', style: containerStyle }, children);
    };
  },
});
