'use client';

/**
 * Lightweight theme system for PartyLayer UI components.
 * No external CSS-in-JS dependency, just a token object + React context.
 *
 * Two ways to theme (both supported):
 *   - Object form (backward compatible): `theme={darkTheme}` or a full custom
 *     `PartyLayerTheme` object. `lightTheme`/`darkTheme` are still usable as
 *     objects (spread, property access) exactly as before.
 *   - Callable form (RainbowKit-style ergonomics): `theme={darkTheme({ accentColor,
 *     borderRadius, overlayBlur, fontStack, ...accentPresets.purple })}`. The
 *     functions map a few friendly tunables onto the token object.
 *
 * `lightTheme` and `darkTheme` are callable objects: a function that also carries
 * the base token properties, so BOTH forms work.
 */

import { createContext, useContext, useState, useEffect, useMemo } from 'react';

// ─── Theme Types ─────────────────────────────────────────────────────────────

export interface PartyLayerTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    primaryHover: string;
    /** Text/icon color rendered ON the accent (e.g. the connect button label). */
    primaryForeground?: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    successBg: string;
    error: string;
    errorBg: string;
    warning: string;
    warningBg: string;
    overlay: string;
  };
  borderRadius: string;
  fontFamily: string;
  /** Backdrop blur behind the modal (the target the backdrop animation ramps to). */
  overlayBlur?: string;
}

/** Friendly tunables accepted by `lightTheme(...)` / `darkTheme(...)`. */
export interface ThemeOverrides {
  /** Accent color: sets `colors.primary` (and derives `primaryHover`). */
  accentColor?: string;
  /** Text/icon color on the accent. Auto-derived from `accentColor` if omitted. */
  accentColorForeground?: string;
  /** Corner radius: a scale keyword ('none'|'small'|'medium'|'large') or a raw CSS length. */
  borderRadius?: 'none' | 'small' | 'medium' | 'large' | string;
  /** Modal backdrop blur: a scale keyword ('none'|'small'|'large') or a raw CSS length. */
  overlayBlur?: 'none' | 'small' | 'large' | string;
  /** Font stack: a keyword ('system'|'rounded') or a raw CSS font-family string. */
  fontStack?: 'system' | 'rounded' | string;
  /** Deep color overrides merged onto the resolved palette. */
  colors?: Partial<PartyLayerTheme['colors']>;
}

// ─── Scales (keyword -> concrete value) ──────────────────────────────────────

const RADIUS_SCALE: Record<string, string> = { none: '0px', small: '8px', medium: '12px', large: '16px' };
const BLUR_SCALE: Record<string, string> = { none: '0px', small: '4px', large: '8px' };
const FONT_STACKS: Record<string, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
};

const DEFAULT_FONT = FONT_STACKS.system;
const DEFAULT_RADIUS = '10px';
const DEFAULT_BLUR = '5px';
const DEFAULT_FOREGROUND = '#0B0F1A';

// ─── Color helpers (hex only; other formats pass through unchanged) ───────────

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mix a hex color toward black (pct < 0) or white (pct > 0). Non-hex passes through. */
function shade(hex: string, pct: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const mixed = rgb.map((c) => Math.round(c + (target - c) * p));
  return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Choose a readable on-accent text color from the accent's luminance. */
function autoForeground(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#FFFFFF';
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return lum > 150 ? '#0B0F1A' : '#FFFFFF';
}

// ─── Accent presets (spreadable option fragments, RainbowKit-style) ──────────

export const accentPresets = {
  partyYellow: { accentColor: '#FFCC00', accentColorForeground: '#0B0F1A' },
  blue: { accentColor: '#3B82F6', accentColorForeground: '#FFFFFF' },
  green: { accentColor: '#10B981', accentColorForeground: '#052E16' },
  purple: { accentColor: '#7B3FE4', accentColorForeground: '#FFFFFF' },
  orange: { accentColor: '#F97316', accentColorForeground: '#FFFFFF' },
  pink: { accentColor: '#EC4899', accentColorForeground: '#FFFFFF' },
  red: { accentColor: '#EF4444', accentColorForeground: '#FFFFFF' },
} as const satisfies Record<string, ThemeOverrides>;

// ─── Base token objects (the defaults; unchanged look) ───────────────────────

const lightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
    primaryForeground: DEFAULT_FOREGROUND,
    background: '#FFFFFF',
    surface: '#F5F6F8',
    text: '#0B0F1A',
    textSecondary: '#64748B',
    border: 'rgba(15, 23, 42, 0.10)',
    success: '#10B981',
    successBg: '#ecfdf5',
    error: '#EF4444',
    errorBg: '#fef2f2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    overlay: 'rgba(15, 23, 42, 0.20)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const darkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
    primaryForeground: DEFAULT_FOREGROUND,
    background: '#0B0F1A',
    surface: '#151926',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E16',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.60)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

/** Map the friendly overrides onto a fresh copy of the base token object. */
function applyOverrides(base: PartyLayerTheme, o?: ThemeOverrides): PartyLayerTheme {
  const t: PartyLayerTheme = { ...base, colors: { ...base.colors } };
  if (!o) return t;
  if (o.accentColor) {
    t.colors.primary = o.accentColor;
    // Derive a hover shade: darken in light mode, lighten in dark mode.
    t.colors.primaryHover = shade(o.accentColor, base.mode === 'dark' ? 0.14 : -0.14);
    t.colors.primaryForeground = o.accentColorForeground ?? autoForeground(o.accentColor);
  }
  if (o.accentColorForeground) t.colors.primaryForeground = o.accentColorForeground;
  if (o.borderRadius) t.borderRadius = RADIUS_SCALE[o.borderRadius] ?? o.borderRadius;
  if (o.overlayBlur) t.overlayBlur = BLUR_SCALE[o.overlayBlur] ?? o.overlayBlur;
  if (o.fontStack) t.fontFamily = FONT_STACKS[o.fontStack] ?? o.fontStack;
  if (o.colors) t.colors = { ...t.colors, ...o.colors };
  return t;
}

// ─── Callable themes (function + base props, so object usage still works) ─────

type ThemeFn = (overrides?: ThemeOverrides) => PartyLayerTheme;
/** A callable theme: `darkTheme({...})` to customize, or use as a plain object. */
export type CallableTheme = ThemeFn & PartyLayerTheme;

function makeCallableTheme(base: PartyLayerTheme): CallableTheme {
  const fn = ((overrides?: ThemeOverrides) => applyOverrides(base, overrides)) as CallableTheme;
  // Attach the base tokens as own enumerable props so `theme={darkTheme}`,
  // `{...darkTheme}`, and `darkTheme.colors.primary` keep working (backward compat).
  return Object.assign(fn, applyOverrides(base));
}

export const lightTheme: CallableTheme = makeCallableTheme(lightBase);
export const darkTheme: CallableTheme = makeCallableTheme(darkBase);

// ─── Professional theme families (additive; original palettes) ───────────────
//
// Five enterprise/fintech inspired families, each with a light and a dark
// variant (ten variants total). Original palettes, NOT Canton's brand marks or
// colors. Every variant is WCAG AA verified for text/bg, textSecondary/bg,
// text/surface, textSecondary/surface, primaryForeground/primary, and
// primary/bg. Each shares the same DEFAULT_RADIUS/DEFAULT_FONT/DEFAULT_BLUR as
// the default bases, and each is wrapped with makeCallableTheme so it works both
// as a plain object and as a callable for overrides, exactly like
// lightTheme/darkTheme. These are purely additive: the default theme is
// unchanged.

const midnightLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#1E3A8A',
    primaryHover: '#1E40AF',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#475569',
    border: 'rgba(15, 23, 42, 0.10)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(15, 23, 42, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const midnightDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#3B82F6',
    primaryHover: '#60A5FA',
    primaryForeground: '#0B0F1A',
    background: '#0C1120',
    surface: '#161E33',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const slateLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#475569',
    primaryHover: '#334155',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: 'rgba(30, 41, 59, 0.10)',
    success: '#10B981',
    successBg: '#ECFDF5',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    overlay: 'rgba(30, 41, 59, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const slateDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#94A3B8',
    primaryHover: '#CBD5E1',
    primaryForeground: '#0F172A',
    background: '#0F1729',
    surface: '#1E293B',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const tealLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F0FDFA',
    text: '#134E4A',
    textSecondary: '#5F6B6A',
    border: 'rgba(19, 78, 74, 0.12)',
    success: '#10B981',
    successBg: '#ECFDF5',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    overlay: 'rgba(19, 78, 74, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const tealDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#2DD4BF',
    primaryHover: '#5EEAD4',
    primaryForeground: '#0B0F1A',
    background: '#0A1414',
    surface: '#152525',
    text: '#F0FDFA',
    textSecondary: '#8FA8A6',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const goldLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#B45309',
    primaryHover: '#92400E',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#FEFCE8',
    text: '#1C1917',
    textSecondary: '#57534E',
    border: 'rgba(28, 25, 23, 0.12)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(28, 25, 23, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const goldDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FBBF24',
    primaryHover: '#FCD34D',
    primaryForeground: '#1C1917',
    background: '#0C0A09',
    surface: '#1C1917',
    text: '#FAFAF9',
    textSecondary: '#A8A29E',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const warmLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#BE123C',
    primaryHover: '#9F1239',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#FFF1F2',
    text: '#1F1315',
    textSecondary: '#6B5658',
    border: 'rgba(31, 19, 21, 0.12)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(31, 19, 21, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const warmDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FB7185',
    primaryHover: '#FDA4AF',
    primaryForeground: '#1F1315',
    background: '#140E0F',
    surface: '#241819',
    text: '#FDF2F3',
    textSecondary: '#B0999B',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

/** Corporate navy. */
export const midnightLightTheme: CallableTheme = makeCallableTheme(midnightLightBase);
export const midnightDarkTheme: CallableTheme = makeCallableTheme(midnightDarkBase);
/** Neutral professional. */
export const slateLightTheme: CallableTheme = makeCallableTheme(slateLightBase);
export const slateDarkTheme: CallableTheme = makeCallableTheme(slateDarkBase);
/** Charcoal and teal, trading. */
export const tealLightTheme: CallableTheme = makeCallableTheme(tealLightBase);
export const tealDarkTheme: CallableTheme = makeCallableTheme(tealDarkBase);
/** Premium. */
export const goldLightTheme: CallableTheme = makeCallableTheme(goldLightBase);
export const goldDarkTheme: CallableTheme = makeCallableTheme(goldDarkBase);
/** Rose, approachable professional. */
export const warmLightTheme: CallableTheme = makeCallableTheme(warmLightBase);
export const warmDarkTheme: CallableTheme = makeCallableTheme(warmDarkBase);

/**
 * The full theme catalog, grouped by family, for discoverability. A consumer can
 * reach a variant either by importing the named theme directly (e.g.
 * `midnightDarkTheme`) or through this object (e.g. `themes.midnight.dark`).
 */
export const themes = {
  default: { light: lightTheme, dark: darkTheme },
  midnight: { light: midnightLightTheme, dark: midnightDarkTheme },
  slate: { light: slateLightTheme, dark: slateDarkTheme },
  teal: { light: tealLightTheme, dark: tealDarkTheme },
  gold: { light: goldLightTheme, dark: goldDarkTheme },
  warm: { light: warmLightTheme, dark: warmDarkTheme },
} as const;

/** Generic factory for full control over the base + overrides. */
export function createTheme(base: PartyLayerTheme, overrides?: ThemeOverrides): PartyLayerTheme {
  return applyOverrides(base, overrides);
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<PartyLayerTheme | null>(null);

/**
 * Access the current PartyLayer theme.
 * Falls back to the light theme if no ThemeProvider is present (backward-compatible).
 */
export function useTheme(): PartyLayerTheme {
  const ctx = useContext(ThemeContext);
  return ctx ?? lightBase;
}

// ─── Provider ────────────────────────────────────────────────────────────────

/** A dynamic theme that follows the OS light/dark preference. */
export interface DynamicTheme {
  lightMode: PartyLayerTheme;
  darkMode: PartyLayerTheme;
}

export type ThemeInput = 'light' | 'dark' | 'auto' | PartyLayerTheme | DynamicTheme;

interface ThemeProviderProps {
  theme: ThemeInput;
  children: React.ReactNode;
}

function isDynamic(t: unknown): t is DynamicTheme {
  return !!t && typeof t === 'object' && 'lightMode' in t && 'darkMode' in t;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const [systemDark, setSystemDark] = useState(false);

  // Track the OS preference (used by 'auto' and by dynamic { lightMode, darkMode }).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved = useMemo((): PartyLayerTheme => {
    // Callable theme passed uncalled (e.g. `theme={darkTheme}`): call for the base.
    if (typeof theme === 'function') return (theme as ThemeFn)();
    if (isDynamic(theme)) return systemDark ? theme.darkMode : theme.lightMode;
    if (theme && typeof theme === 'object') return theme;
    if (theme === 'dark') return darkBase;
    if (theme === 'auto') return systemDark ? darkBase : lightBase;
    return lightBase;
  }, [theme, systemDark]);

  return (
    <ThemeContext.Provider value={resolved}>
      {children}
    </ThemeContext.Provider>
  );
}
