'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useLocale, resolvePartyLayerLocale, type PartyLayerLocale } from './localization';
import { partyLayerLocales } from './locales/catalog';
import { useTheme } from './theme';

export interface LanguageSelectorProps {
  value: PartyLayerLocale;
  onChange: (locale: PartyLayerLocale) => void;
  /** Optional accessible label prefix in the surrounding application's language. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Controlled, searchable locale picker. Changing language never reconnects a wallet. */
export function LanguageSelector({ value, onChange, 'aria-label': label, className, style }: LanguageSelectorProps) {
  const theme = useTheme();
  const { t, direction, locale, isLocaleLoading, localeLoadFailed } = useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ left: 0, above: false, height: 360 });
  const previousLocale = useRef(locale);
  const [announcement, setAnnouncement] = useState('');
  const selected = partyLayerLocales.find(item => item.locale === resolvePartyLayerLocale(value))!;
  const filtered = partyLayerLocales.filter(item => normalize(`${item.nativeName} ${item.name} ${item.locale}`).includes(normalize(query.trim())));
  const activeItem = filtered[active];
  const optionId = (code: string) => `${id}-option-${code}`;
  const activeOptionId = activeItem ? `${id}-option-${activeItem.locale}` : undefined;
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus(); };
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const upwards = below < 360 && above > below;
      const width = Math.min(304, window.innerWidth - 32);
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      setPlacement({ left: left - (root.current?.getBoundingClientRect().left ?? rect.left), above: upwards, height: Math.max(80, Math.min(360, upwards ? above : below)) });
    }
    setQuery(''); setActive(partyLayerLocales.findIndex(item => item.locale === value)); setOpen(true);
  };
  const choose = (code: PartyLayerLocale) => { onChange(code); close(true); };
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open && activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeOptionId]);
  useEffect(() => {
    if (previousLocale.current !== locale) {
      setAnnouncement(t('languageChanged', { language: partyLayerLocales.find(item => item.locale === locale)!.nativeName }));
      previousLocale.current = locale;
    }
  }, [locale, t]);
  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setActive(index => filtered.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0);
    } else if (event.key === 'Enter') { event.preventDefault(); if (activeItem) choose(activeItem.locale); }
    else if (event.key === 'Tab') { requestAnimationFrame(() => setOpen(false)); }
  };
  return (
    <div ref={root} data-pl-language-picker className={className} dir={direction} style={{
      position: 'relative', display: 'inline-flex', maxWidth: '100%', fontFamily: theme.fontFamily,
      '--pl-language-bg': theme.colors.background, '--pl-language-surface': theme.colors.surface,
      '--pl-language-text': theme.colors.text, '--pl-language-muted': theme.colors.textSecondary,
      '--pl-language-border': theme.colors.border, ...style,
    } as CSSProperties}>
      <button ref={trigger} type="button" className="pl-language-trigger" aria-label={`${label ?? t('language')}: ${selected.nativeName}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-dialog` : undefined}
        aria-busy={isLocaleLoading || undefined}
        onClick={() => open ? close() : show()}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/></svg>
        <bdi lang={selected.locale}>{selected.nativeName}</bdi>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && <div id={`${id}-dialog`} role="dialog" aria-label={t('language')} className="pl-language-popover" style={{
        left: placement.left,
        top: placement.above ? 'auto' : 'calc(100% + 8px)', bottom: placement.above ? 'calc(100% + 8px)' : 'auto',
        maxHeight: placement.height,
      }}>
        <div className="pl-language-heading"><span>{t('language')}</span><span aria-hidden="true">{partyLayerLocales.length}</span></div>
        <div className="pl-language-search"><input ref={input} type="search" role="combobox" aria-autocomplete="list"
          aria-label={t('searchLanguages')} placeholder={t('searchLanguages')} aria-expanded="true"
          aria-controls={`${id}-list`} aria-activedescendant={activeItem ? optionId(activeItem.locale) : undefined}
          value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={navigate} /></div>
        <div id={`${id}-list`} role="listbox" aria-label={t('language')} className="pl-language-list">
          {filtered.map((item, index) => <button type="button" role="option" tabIndex={-1} key={item.locale}
            id={optionId(item.locale)} aria-selected={value === item.locale} data-active={index === active || undefined}
            data-locale={item.locale} className="pl-language-option" onPointerMove={() => setActive(index)}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(item.locale)}>
            <span className="pl-language-names"><bdi lang={item.locale}>{item.nativeName}</bdi>
              {item.name !== item.nativeName && <span lang="en">{item.name}</span>}</span>
            <span className="pl-language-end" aria-hidden="true">{value === item.locale ? '✓' : item.locale.toUpperCase()}</span>
          </button>)}
        </div>
        {filtered.length === 0 && <p role="status" className="pl-language-empty">{t('noLanguages')}</p>}
      </div>}
      <span role="status" aria-live="polite" className="pl-language-sr">{isLocaleLoading ? t('languageLoading') : announcement}</span>
      {localeLoadFailed && <span role="status" className="pl-language-error">{t('languageLoadFailed')}</span>}
      <style>{`
        [data-pl-language-picker] button, [data-pl-language-picker] input { font-family: inherit; box-sizing: border-box; }
        .pl-language-trigger { display: inline-flex; align-items: center; gap: 10px; min-height: 40px; max-width: 100%; padding: 9px 12px; border: 1px solid var(--pl-language-border); border-radius: 10px; background: var(--pl-language-bg); color: var(--pl-language-text); cursor: pointer; font-size: 13px; font-weight: 500; transition: background 120ms; }
        .pl-language-trigger:hover { background: var(--pl-language-surface); }
        .pl-language-trigger bdi { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-language-trigger svg { flex-shrink: 0; }
        .pl-language-popover { position: absolute; z-index: 60; width: min(304px, calc(100vw - 32px)); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--pl-language-border); border-radius: 16px; background: var(--pl-language-bg); color: var(--pl-language-text); box-shadow: 0 16px 48px rgba(0,0,0,.16); padding: 6px; box-sizing: border-box; }
        .pl-language-heading { display: flex; justify-content: space-between; padding: 10px 10px 8px; font-size: 13px; font-weight: 600; flex-shrink: 0; }
        .pl-language-heading span:last-child { color: var(--pl-language-muted); font-weight: 400; }
        .pl-language-search { padding: 2px 6px 8px; flex-shrink: 0; }
        .pl-language-search input { width: 100%; min-height: 40px; padding: 9px 12px; border: 1px solid var(--pl-language-border); border-radius: 9px; background: var(--pl-language-surface); color: var(--pl-language-text); font-size: 14px; }
        .pl-language-search input::placeholder { color: var(--pl-language-muted); opacity: 1; }
        .pl-language-list { overflow-y: auto; min-height: 0; overscroll-behavior: contain; scrollbar-width: thin; }
        .pl-language-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 9px 12px; border: 0; border-radius: 9px; background: transparent; color: var(--pl-language-text); text-align: start; cursor: pointer; }
        .pl-language-option[data-active] { background: var(--pl-language-surface); }
        .pl-language-option[aria-selected=true] { font-weight: 600; }
        .pl-language-names { display: flex; flex-direction: column; align-items: start; gap: 2px; font-size: 14px; }
        .pl-language-names > span { font-size: 11px; color: var(--pl-language-muted); font-weight: 400; }
        .pl-language-end { color: var(--pl-language-muted); font-size: 11px; flex-shrink: 0; }
        .pl-language-option[aria-selected=true] .pl-language-end { color: var(--pl-language-text); font-size: 16px; }
        .pl-language-empty { padding: 14px 12px; margin: 0; color: var(--pl-language-muted); font-size: 13px; }
        .pl-language-error { position: absolute; top: calc(100% + 4px); width: 260px; color: var(--pl-language-text); font-size: 12px; }
        .pl-language-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        @media (pointer: coarse) { .pl-language-trigger { min-height: 44px; } .pl-language-search input { font-size: 16px; } }
        @media (prefers-reduced-motion: reduce) { .pl-language-trigger { transition: none; } }
      `}</style>
    </div>
  );
}
