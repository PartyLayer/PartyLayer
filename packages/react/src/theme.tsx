'use client';

/**
 * Lightweight theme system for PartyLayer UI components.
 * No external CSS-in-JS dependency — just a token object + React context.
 */

import { createContext, useContext, useState, useEffect, useMemo } from 'react';

// ─── Theme Types ─────────────────────────────────────────────────────────────

export interface PartyLayerTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    primaryHover: string;
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
}

// ─── Built-in Presets ────────────────────────────────────────────────────────

export const lightTheme: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
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
  borderRadius: '10px',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

export const darkTheme: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
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
  borderRadius: '10px',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<PartyLayerTheme | null>(null);

/**
 * Access the current PartyLayer theme.
 * Falls back to lightTheme if no ThemeProvider is present (backward-compatible).
 */
export function useTheme(): PartyLayerTheme {
  const ctx = useContext(ThemeContext);
  return ctx ?? lightTheme;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  theme: 'light' | 'dark' | 'auto' | PartyLayerTheme;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (theme !== 'auto') return;
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const resolved = useMemo((): PartyLayerTheme => {
    if (typeof theme === 'object') return theme;
    if (theme === 'dark') return darkTheme;
    if (theme === 'auto') return systemDark ? darkTheme : lightTheme;
    return lightTheme;
  }, [theme, systemDark]);

  return (
    <ThemeContext.Provider value={resolved}>
      {children}
    </ThemeContext.Provider>
  );
}
