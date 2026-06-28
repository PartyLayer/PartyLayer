// @vitest-environment happy-dom
/**
 * CostPreview tests: the Vue mirror of React's CostPreview tests, with
 * @vue/test-utils. A presentational defineComponent (no provider, no composable):
 * it renders cost data passed as props. Covers the estimate fields, the paid value,
 * the empty (render-nothing) case, formatCost (and raw string default), the
 * loading/error states, and the class fallthrough (consumer class on the root).
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';
import { CostPreview } from '../cost-preview';

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

describe('CostPreview (Vue mirror of React CostPreview)', () => {
  it('renders the estimate cost fields (request, response, total)', () => {
    const w = mount(CostPreview, { props: { estimate } });
    const text = w.text();
    expect(text).toContain('Confirmation request');
    expect(text).toContain('Confirmation response');
    expect(text).toContain('Total');
    expect(text).toContain('100');
    expect(text).toContain('200');
    expect(text).toContain('300');
  });

  it('renders the paid value when paid is provided', () => {
    const w = mount(CostPreview, { props: { paid: toTrafficCost('500') } });
    expect(w.text()).toContain('Actual paid');
    expect(w.text()).toContain('500');
  });

  it('renders nothing when there is no data and no loading/error', () => {
    const w = mount(CostPreview, { props: {} });
    expect(w.find('.pl-cost-preview').exists()).toBe(false);
    expect(w.text()).toBe('');
  });

  it('renders the raw int64 string by default (no invented unit)', () => {
    const w = mount(CostPreview, { props: { estimate } });
    // raw values, verbatim
    expect(w.text()).toContain('100');
    expect(w.text()).not.toContain('CC ');
  });

  it('applies formatCost when provided', () => {
    const w = mount(CostPreview, { props: { estimate, formatCost: (c) => `CC ${c}` } });
    expect(w.text()).toContain('CC 100');
    expect(w.text()).toContain('CC 300');
  });

  it('shows a loading state', () => {
    const w = mount(CostPreview, { props: { loading: true } });
    expect(w.find('.pl-cost-preview').exists()).toBe(true);
    expect(w.text()).toContain('Estimating cost');
  });

  it('shows an error state with the message', () => {
    const w = mount(CostPreview, { props: { error: new Error('prepare failed') } });
    expect(w.text()).toContain('Could not load the cost');
    expect(w.text()).toContain('prepare failed');
  });

  it('falls through consumer class/style to the root (no explicit className prop needed)', () => {
    const w = mount(CostPreview, { props: { estimate }, attrs: { class: 'my-cost', style: 'margin: 8px' } });
    const root = w.find('.pl-cost-preview');
    expect(root.exists()).toBe(true);
    expect(root.classes()).toContain('my-cost'); // Vue merges consumer class with the base class
    expect(root.attributes('style')).toContain('margin: 8px');
  });
});
