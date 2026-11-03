// @vitest-environment jsdom
import React, { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { LanguageSelector } from './language-selector';
import { PartyLayerLocaleProvider, resolvePartyLayerLocale, useLocale, type PartyLayerLocale } from './localization';
import { partyLayerLocales } from './locales/catalog';
import { en, tr } from './locales/base';

const imports = {
  es: () => import('./locales/es'), fr: () => import('./locales/fr'), de: () => import('./locales/de'),
  pt: () => import('./locales/pt'), it: () => import('./locales/it'), ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'), hi: () => import('./locales/hi'), id: () => import('./locales/id'),
  ja: () => import('./locales/ja'), ko: () => import('./locales/ko'), zh: () => import('./locales/zh'),
};
afterEach(cleanup);
function Probe() {
  const { t, locale, direction, isLocaleLoading } = useLocale();
  return <div data-testid="probe" lang={locale} dir={direction} aria-busy={isLocaleLoading}>{t('connectWallet')}<span>{t('account', { party: 'party::unchanged' })}</span></div>;
}

describe('complete locale catalogs', () => {
  it('covers all 14 languages, every message and the exact interpolation parameters', async () => {
    const catalogs = { en, tr, ...Object.fromEntries(await Promise.all(Object.entries(imports).map(async ([code, load]) => [code, (await load()).default]))) };
    expect(Object.keys(catalogs).sort()).toEqual(partyLayerLocales.map(item => item.locale).sort());
    for (const [code, messages] of Object.entries(catalogs)) {
      expect(Object.keys(messages).sort(), code).toEqual(Object.keys(en).sort());
      for (const [key, english] of Object.entries(en)) {
        const value = messages[key as keyof typeof en];
        expect(value.trim().length, `${code}:${key}`).toBeGreaterThan(0);
        const parameters = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
        expect(parameters(value), `${code}:${key}`).toEqual(parameters(english));
      }
    }
  });
  it('normalizes regional tags and rejects unsupported or prototype-like values', () => {
    for (const [tag, expected] of [['es-MX','es'], ['fr_CA','fr'], ['ar-SA','ar'], ['zh-Hans-CN','zh'], ['zh-TW','en'], ['zh-Hant','en'], [' TR_tr ','tr'], ['constructor','en'], ['__proto__','en'], ['xx-XX','en']]) {
      expect(resolvePartyLayerLocale(tag)).toBe(expected);
    }
  });
  it('loads every additional language without replacing the application subtree', async () => {
    let mounts = 0;
    function Identity() { useEffect(() => { mounts++; }, []); return <Probe />; }
    const view = render(<PartyLayerLocaleProvider><Identity /></PartyLayerLocaleProvider>);
    for (const code of Object.keys(imports) as (keyof typeof imports)[]) {
      const messages = (await imports[code]()).default;
      view.rerender(<PartyLayerLocaleProvider locale={code}><Identity /></PartyLayerLocaleProvider>);
      await waitFor(() => expect(screen.getByTestId('probe').lang).toBe(code));
      expect(screen.getByText(messages.connectWallet)).not.toBeNull();
      expect(screen.getByTestId('probe').textContent).toContain('party::unchanged');
    }
    expect(mounts).toBe(1);
  });
  it('ignores a late catalog after a newer language was selected', async () => {
    const view = render(<PartyLayerLocaleProvider locale="ja"><Probe /></PartyLayerLocaleProvider>);
    view.rerender(<PartyLayerLocaleProvider locale="tr"><Probe /></PartyLayerLocaleProvider>);
    await imports.ja();
    await waitFor(() => expect(screen.getByTestId('probe').lang).toBe('tr'));
    expect(screen.getByTestId('probe').textContent).toContain('Cüzdan Bağla');
  });
  it('retains the last visible synchronous catalog while another language loads', async () => {
    const view = render(<PartyLayerLocaleProvider locale="ja"><Probe /></PartyLayerLocaleProvider>);
    await waitFor(() => expect(screen.getByTestId('probe').lang).toBe('ja'));
    view.rerender(<PartyLayerLocaleProvider locale="tr"><Probe /></PartyLayerLocaleProvider>);
    view.rerender(<PartyLayerLocaleProvider locale="es"><Probe /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('probe').lang).toBe('tr');
    await waitFor(() => expect(screen.getByTestId('probe').lang).toBe('es'));
  });
  it('defaults Arabic to RTL, isolates dynamic identifiers and respects explicit direction', async () => {
    const view = render(<PartyLayerLocaleProvider locale="ar-SA"><Probe /></PartyLayerLocaleProvider>);
    await waitFor(() => expect(screen.getByTestId('probe').lang).toBe('ar'));
    expect(screen.getByTestId('probe').dir).toBe('rtl');
    expect(screen.getByTestId('probe').textContent).toContain('\u2068party::unchanged\u2069');
    view.rerender(<PartyLayerLocaleProvider locale="ar" direction="ltr"><Probe /></PartyLayerLocaleProvider>);
    expect(screen.getByTestId('probe').dir).toBe('ltr');
  });
  it('keeps server output deterministic for lazy locales even after catalogs were imported', () => {
    const html = renderToString(<PartyLayerLocaleProvider locale="ja"><Probe /></PartyLayerLocaleProvider>);
    expect(html).toContain('Connect Wallet'); expect(html).toContain('lang="en"'); expect(html).toContain('aria-busy="true"');
  });
});

describe('language selector', () => {
  function Example() {
    const [locale, setLocale] = useState<PartyLayerLocale>('en');
    return <PartyLayerLocaleProvider locale={locale}><LanguageSelector value={locale} onChange={setLocale} aria-label="Wallet UI language" /><Probe /></PartyLayerLocaleProvider>;
  }
  it('searches native names without accents, selects with the keyboard and restores focus', async () => {
    render(<Example />);
    const trigger = screen.getByRole('button', { name: /^Wallet UI language:/ });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const search = screen.getByRole('combobox', { name: 'Search languages' });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'francais' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    await waitFor(() => expect(screen.getByTestId('probe').lang).toBe('fr'));
    expect(trigger.textContent).toContain('Français');
  });
  it('announces no results, dismisses with Escape and leaves selection unchanged', () => {
    render(<Example />);
    const trigger = screen.getByRole('button', { name: /^Wallet UI language:/ }); fireEvent.click(trigger);
    const search = screen.getByRole('combobox', { name: 'Search languages' });
    fireEvent.change(search, { target: { value: 'zzzzzz' } });
    expect(screen.getByText('No languages found')).not.toBeNull();
    fireEvent.keyDown(search, { key: 'Enter' }); expect(screen.getByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(search, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(trigger.textContent).toContain('English');
  });
  it('dismisses on an outside pointer event without stealing focus', () => {
    render(<><Example /><button type="button">Outside</button></>);
    fireEvent.click(screen.getByRole('button', { name: /^Wallet UI language:/ }));
    const outside = screen.getByRole('button', { name: 'Outside' }); outside.focus(); fireEvent.pointerDown(outside);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(outside);
  });
});
