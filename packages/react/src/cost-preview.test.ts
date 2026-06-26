// @vitest-environment jsdom
/**
 * CostPreview — presentational traffic-cost panel.
 *
 * Uses React.createElement (no JSX) — the package has no JSX test toolchain
 * (see modal-qr.test.ts). CostPreview needs no provider: useTheme falls back to
 * lightTheme.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';
import { CostPreview } from './cost-preview';

afterEach(cleanup);

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

describe('CostPreview', () => {
  it('renders request, response, and total values (with a Total row)', () => {
    render(createElement(CostPreview, { estimate }));
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('300')).toBeTruthy();
    expect(screen.getByText('Confirmation request')).toBeTruthy();
    expect(screen.getByText('Confirmation response')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('applies formatCost when provided', () => {
    render(
      createElement(CostPreview, {
        estimate,
        formatCost: (c) => `CC ${c}`,
      }),
    );
    expect(screen.getByText('CC 100')).toBeTruthy();
    expect(screen.getByText('CC 300')).toBeTruthy();
  });

  it('renders the RAW int64 string intact when formatCost is omitted (no precision mangling)', () => {
    const big = '9223372036854775807'; // 2^63 - 1, beyond Number.MAX_SAFE_INTEGER
    render(
      createElement(CostPreview, {
        estimate: {
          estimationTimestamp: '2026-06-26T00:00:00Z',
          confirmationRequestTrafficCostEstimation: toTrafficCost('1'),
          confirmationResponseTrafficCostEstimation: toTrafficCost('2'),
          totalTrafficCostEstimation: toTrafficCost(big),
        },
      }),
    );
    expect(screen.getByText(big)).toBeTruthy(); // exact string, no rounding
  });

  it('renders an "Actual paid" row, and works with paid alone (no estimate)', () => {
    render(createElement(CostPreview, { paid: toTrafficCost('500') }));
    expect(screen.getByText('Actual paid')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    // no estimate rows
    expect(screen.queryByText('Confirmation request')).toBeNull();
  });

  it('shows the loading line', () => {
    render(createElement(CostPreview, { loading: true }));
    expect(screen.getByText(/Estimating cost/i)).toBeTruthy();
  });

  it('shows the error message', () => {
    render(createElement(CostPreview, { error: new Error('prepare failed') }));
    expect(screen.getByText(/prepare failed/)).toBeTruthy();
  });

  it('renders nothing when no estimate/paid/loading/error', () => {
    const { container } = render(createElement(CostPreview, {}));
    expect(container.firstChild).toBeNull();
  });

  it('applies className and style to the container', () => {
    const { container } = render(
      createElement(CostPreview, {
        estimate,
        className: 'cost-card',
        style: { marginTop: '5px' },
      }),
    );
    const el = container.querySelector('.cost-card') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.marginTop).toBe('5px');
  });
});
