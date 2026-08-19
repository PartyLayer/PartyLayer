// @vitest-environment jsdom
/**
 * ThemeProvider and useTheme.
 *
 * The behaviours that matter: useTheme never throws without a provider, the explicit prop
 * still wins so existing callers are unaffected, and 'auto' follows the OS preference.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ThemeProvider, useTheme, useResolvedTheme } from '../theme-context';
import { themes } from '../theme-data';
import { toReactNativeTheme } from '../theme';

const colorScheme = vi.hoisted(() => ({ current: 'light' as 'light' | 'dark' | null }));

vi.mock('react-native', () => ({
  useColorScheme: () => colorScheme.current,
}));

beforeEach(() => {
  colorScheme.current = 'light';
});

function wrapper(theme: Parameters<typeof ThemeProvider>[0]['theme']) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  };
}

describe('useTheme', () => {
  it('falls back to the default light theme with NO provider, and does not throw', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('light');
    expect(result.current).toEqual(toReactNativeTheme(themes.default.light));
  });

  it('returns the dark theme when the provider is set to dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
    expect(result.current.mode).toBe('dark');
    expect(result.current).toEqual(toReactNativeTheme(themes.default.dark));
  });

  it('follows the OS preference when set to auto', () => {
    colorScheme.current = 'dark';
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper('auto') });
    expect(result.current.mode).toBe('dark');

    colorScheme.current = 'light';
    const second = renderHook(() => useTheme(), { wrapper: wrapper('auto') });
    expect(second.result.current.mode).toBe('light');
  });

  it('adapts a PartyLayerTheme from the shared catalog', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(themes.midnight.dark) });
    expect(result.current).toEqual(toReactNativeTheme(themes.midnight.dark));
    // Adapted, so borderRadius is the parsed number rather than the source CSS length.
    expect(typeof result.current.borderRadius).toBe('number');
  });

  it('passes an already adapted ReactNativeTheme through unchanged', () => {
    const adapted = toReactNativeTheme(themes.teal.light);
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(adapted) });
    expect(result.current).toBe(adapted);
  });

  it('chooses from a lightMode and darkMode pair by the OS preference', () => {
    const pair = { lightMode: themes.gold.light, darkMode: themes.gold.dark };
    colorScheme.current = 'dark';
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper(pair) });
    expect(result.current).toEqual(toReactNativeTheme(themes.gold.dark));
  });
});

describe('useResolvedTheme', () => {
  it('prefers an explicit theme over the provider, so a prop still wins', () => {
    const explicit = toReactNativeTheme(themes.warm.dark);
    const { result } = renderHook(() => useResolvedTheme(explicit), { wrapper: wrapper('light') });
    expect(result.current).toBe(explicit);
  });

  it('uses the provider when no explicit theme is given', () => {
    const { result } = renderHook(() => useResolvedTheme(undefined), { wrapper: wrapper('dark') });
    expect(result.current.mode).toBe('dark');
  });

  it('uses the default when there is neither a prop nor a provider', () => {
    const { result } = renderHook(() => useResolvedTheme(undefined));
    expect(result.current).toEqual(toReactNativeTheme(themes.default.light));
  });
});
