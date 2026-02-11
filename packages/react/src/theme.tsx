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
    primary: '#2196f3',
    primaryHover: '#1976d2',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#1a1a2e',
    textSecondary: '#666666',
    border: '#e0e0e0',
    success: '#2e7d32',
    successBg: '#e8f5e9',
    error: '#d32f2f',
    errorBg: '#ffebee',
    warning: '#f57c00',
    warningBg: '#fff3e0',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export const darkTheme: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#64b5f6',
    primaryHover: '#42a5f5',
    background: '#121212',
    surface: '#1e1e2e',
    text: '#e0e0e0',
    textSecondary: '#a0a0a0',
    border: '#333333',
    success: '#66bb6a',
    successBg: '#1b3a1b',
    error: '#ef5350',
    errorBg: '#3a1b1b',
    warning: '#ffa726',
    warningBg: '#3a2e1b',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
