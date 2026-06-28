// @vitest-environment happy-dom
/**
 * PartyAvatar tests (@vue/test-utils): a presentational, deterministic avatar. It
 * receives the party id as a prop and renders a pure function of it. Covers: renders
 * with a party (initials + a derived color), determinism (same party same color,
 * different party different color), renders nothing when absent, formatLabel, and size.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { PartyAvatar } from '../party-avatar';

const styleOf = (party: string | null) =>
  mount(PartyAvatar, { props: { party } }).find('.pl-party-avatar').attributes('style') ?? '';

describe('PartyAvatar', () => {
  it('renders a derived avatar with initials for a party', () => {
    const w = mount(PartyAvatar, { props: { party: 'party::alice' } });
    const root = w.find('.pl-party-avatar');
    expect(root.exists()).toBe(true);
    expect(w.text()).toBe('PA'); // first two alphanumeric chars, uppercased
    expect(root.attributes('title')).toBe('party::alice');
  });

  it('derives a deterministic color (same party yields the same color)', () => {
    expect(styleOf('party::alice')).toBe(styleOf('party::alice'));
    expect(styleOf('party::alice')).toContain('hsl(98');
  });

  it('different parties yield different colors', () => {
    expect(styleOf('party::alice')).not.toBe(styleOf('party::bob'));
    expect(styleOf('party::bob')).toContain('hsl(279');
  });

  it('renders nothing when there is no party', () => {
    expect(mount(PartyAvatar, { props: { party: null } }).find('.pl-party-avatar').exists()).toBe(false);
    expect(mount(PartyAvatar, { props: { party: '' } }).text()).toBe('');
  });

  it('applies formatLabel when provided', () => {
    const w = mount(PartyAvatar, { props: { party: 'party::alice', formatLabel: (p) => p.slice(0, 1).toUpperCase() } });
    expect(w.text()).toBe('P');
  });

  it('applies size to the dimensions', () => {
    const style = mount(PartyAvatar, { props: { party: 'party::alice', size: 48 } })
      .find('.pl-party-avatar')
      .attributes('style');
    expect(style).toContain('width: 48px');
    expect(style).toContain('height: 48px');
  });
});
