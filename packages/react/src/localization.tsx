'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, tr, type LocaleMessages, type MessageKey } from './locales/base';

export type PartyLayerLocale = 'en' | 'tr' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ru' | 'ar' | 'hi' | 'id' | 'ja' | 'ko' | 'zh';
export type PartyLayerDirection = 'ltr' | 'rtl';

const loaders = {
  es: () => import('./locales/es'), fr: () => import('./locales/fr'),
  de: () => import('./locales/de'), pt: () => import('./locales/pt'),
  it: () => import('./locales/it'), ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'), hi: () => import('./locales/hi'),
  id: () => import('./locales/id'), ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'), zh: () => import('./locales/zh'),
};

/** Regional tags share a catalog; unknown tags retain the English fallback. */
export function resolvePartyLayerLocale(value: string): PartyLayerLocale {
  const tag = value.trim().toLowerCase().replace(/_/g, '-');
  const language = tag.split('-')[0];
  // The Chinese catalog is Simplified; do not label Traditional text as supported.
  if (language === 'zh' && /-(hant|tw|hk|mo)(-|$)/.test(tag)) return 'en';
  return language === 'tr' ? 'tr' : Object.hasOwn(loaders, language) ? language as PartyLayerLocale : 'en';
}

type Parameters = Record<string, string | number>;
function translator(messages: LocaleMessages, locale: PartyLayerLocale) {
  return (key: MessageKey, values?: Parameters): string =>
    messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      if (values?.[name] === undefined) return placeholder;
      const value = String(values[name]);
      return locale === 'ar' ? `\u2068${value}\u2069` : value;
    });
}

interface LocaleContextValue {
  locale: PartyLayerLocale;
  direction: PartyLayerDirection;
  isLocaleLoading: boolean;
  localeLoadFailed: boolean;
  t: ReturnType<typeof translator>;
}
const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en', direction: 'ltr', isLocaleLoading: false, localeLoadFailed: false, t: translator(en, 'en'),
});

export interface PartyLayerLocaleProviderProps {
  /** Wallet UI language. Supports 14 languages and regional tags; unknown tags use English. */
  locale?: string;
  /** Overrides automatic direction (Arabic defaults to RTL). */
  direction?: PartyLayerDirection;
  children: ReactNode;
}

/** No browser-language guess, global DOM mutation or provider remount on language changes. */
export function PartyLayerLocaleProvider({ locale = 'en', direction, children }: PartyLayerLocaleProviderProps) {
  const requested = resolvePartyLayerLocale(locale);
  // Keep the server and initial hydration deterministic, even if another request
  // has already downloaded a catalog. English/Turkish remain synchronous.
  const [loaded, setLoaded] = useState<{ locale: PartyLayerLocale; messages: LocaleMessages }>({ locale: 'en', messages: en });
  const [failed, setFailed] = useState<PartyLayerLocale | null>(null);
  useEffect(() => {
    if (requested === 'en' || requested === 'tr') {
      setLoaded(current => current.locale === requested ? current : { locale: requested, messages: requested === 'tr' ? tr : en });
      setFailed(null);
      return;
    }
    let current = true;
    setFailed(null);
    loaders[requested]().then(module => {
      if (current) setLoaded({ locale: requested, messages: module.default });
    }).catch(() => { if (current) setFailed(requested); });
    return () => { current = false; };
  }, [requested]);
  const active = requested === 'en' || requested === 'tr'
    ? { locale: requested, messages: requested === 'tr' ? tr : en }
    : loaded;
  const value = useMemo(() => ({
    locale: active.locale,
    direction: direction ?? (active.locale === 'ar' ? 'rtl' : 'ltr'),
    isLocaleLoading: active.locale !== requested && failed !== requested,
    localeLoadFailed: failed === requested,
    t: translator(active.messages, active.locale),
  }), [active.locale, active.messages, direction, requested, failed]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Applications retain ownership of their own content translations. */
export function useLocale(): LocaleContextValue { return useContext(LocaleContext); }
export type Translate = LocaleContextValue['t'];
