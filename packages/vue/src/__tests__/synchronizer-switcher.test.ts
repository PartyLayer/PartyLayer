// @vitest-environment happy-dom
/**
 * SynchronizerSwitcher tests (@vue/test-utils): a presentational switcher. It renders
 * consumer-provided options and EMITS the selection; it does not perform the switch.
 * Covers: renders the options, reflects the current networkId, emits 'switch' with the
 * selected id on change, and renders nothing when there are no options.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { SynchronizerSwitcher } from '../synchronizer-switcher';

const options = [
  { networkId: 'canton:da-devnet', label: 'DevNet' },
  { networkId: 'canton:da-testnet', label: 'TestNet' },
  { networkId: 'canton:da-mainnet' }, // label falls back to networkId
];

describe('SynchronizerSwitcher', () => {
  it('renders the provided options (label falls back to networkId)', () => {
    const w = mount(SynchronizerSwitcher, { props: { networkId: 'canton:da-devnet', options } });
    const opts = w.findAll('option');
    expect(opts).toHaveLength(3);
    expect(opts[0].text()).toBe('DevNet');
    expect(opts[2].text()).toBe('canton:da-mainnet'); // fallback
    expect(w.find('.pl-synchronizer-switcher').exists()).toBe(true);
  });

  it('reflects the current networkId as the selected option', () => {
    const w = mount(SynchronizerSwitcher, { props: { networkId: 'canton:da-testnet', options } });
    expect((w.find('select').element as HTMLSelectElement).value).toBe('canton:da-testnet');
  });

  it("emits 'switch' with the selected networkId on change (does not switch itself)", async () => {
    const w = mount(SynchronizerSwitcher, { props: { networkId: 'canton:da-devnet', options } });
    await w.find('select').setValue('canton:da-testnet');
    expect(w.emitted('switch')).toBeTruthy();
    expect(w.emitted('switch')![0]).toEqual(['canton:da-testnet']);
  });

  it('renders nothing when there are no options', () => {
    expect(mount(SynchronizerSwitcher, { props: { options: [] } }).find('.pl-synchronizer-switcher').exists()).toBe(false);
    expect(mount(SynchronizerSwitcher, { props: {} }).text()).toBe('');
  });
});
