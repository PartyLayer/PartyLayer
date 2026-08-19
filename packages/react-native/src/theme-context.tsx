/**
 * Theme provider and hook.
 *
 * Mirrors the react package's `ThemeProvider` and `useTheme`, including the important
 * detail that `useTheme` FALLS BACK rather than throwing when there is no provider, so a
 * component can be rendered anywhere.
 *
 * It composes with the existing per component `theme` prop rather than replacing it. Every
 * component resolves its theme as: the explicit prop, then this context, then the default.
 * Passing the prop keeps working exactly as it did.
 *
 * The OS light or dark preference comes from `useColorScheme`, which is part of
 * react-native, so this adds no dependency. The web equivalent uses `window.matchMedia`.
 */
import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type PartyLayerTheme } from './theme-data';
import { toReactNativeTheme, type ReactNativeTheme } from './theme';

/** A pair of themes chosen by the OS light or dark preference. */
export interface DynamicReactNativeTheme {
  lightMode: ReactNativeTheme | PartyLayerTheme;
  darkMode: ReactNativeTheme | PartyLayerTheme;
}

/**
 * What `ThemeProvider` accepts:
 * - `'light'`, `'dark'` or `'auto'` to use the default family,
 * - a `PartyLayerTheme` from the shared catalog, adapted for you,
 * - a `ReactNativeTheme` already adapted with `toReactNativeTheme`,
 * - a `{ lightMode, darkMode }` pair chosen by the OS preference.
 */
export type ReactNativeThemeInput =
  | 'light'
  | 'dark'
  | 'auto'
  | PartyLayerTheme
  | ReactNativeTheme
  | DynamicReactNativeTheme;

const ThemeContext = createContext<ReactNativeTheme | null>(null);

/** The default when there is no provider and no prop: the light theme of the default family. */
const DEFAULT_THEME: ReactNativeTheme = toReactNativeTheme(themes.default.light);

/**
 * The current theme.
 *
 * Falls back to the default light theme when no `ThemeProvider` is present, matching the
 * web hook, so this never throws.
 */
export function useTheme(): ReactNativeTheme {
  return useContext(ThemeContext) ?? DEFAULT_THEME;
}

/**
 * Resolve a component's theme: the explicit prop wins, then the provider, then the default.
 *
 * Components call this instead of reading the context directly, so the precedence is
 * defined in exactly one place.
 */
export function useResolvedTheme(explicit?: ReactNativeTheme): ReactNativeTheme {
  const fromContext = useTheme();
  return explicit ?? fromContext;
}

/**
 * A `ReactNativeTheme` has its `borderRadius` already parsed to a number, while a
 * `PartyLayerTheme` carries the source CSS length as a string. That is the cheapest
 * reliable discriminator between the two, and it means a caller can pass either.
 */
function isReactNativeTheme(value: ReactNativeTheme | PartyLayerTheme): value is ReactNativeTheme {
  return typeof (value as ReactNativeTheme).borderRadius === 'number';
}

function adapt(value: ReactNativeTheme | PartyLayerTheme): ReactNativeTheme {
  return isReactNativeTheme(value) ? value : toReactNativeTheme(value);
}

function isDynamic(value: unknown): value is DynamicReactNativeTheme {
  return !!value && typeof value === 'object' && 'lightMode' in value && 'darkMode' in value;
}

export interface ThemeProviderProps {
  theme: ReactNativeThemeInput;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const scheme = useColorScheme();
  const systemDark = scheme === 'dark';

  const resolved = useMemo((): ReactNativeTheme => {
    if (isDynamic(theme)) return adapt(systemDark ? theme.darkMode : theme.lightMode);
    if (theme === 'dark') return toReactNativeTheme(themes.default.dark);
    if (theme === 'auto') {
      return toReactNativeTheme(systemDark ? themes.default.dark : themes.default.light);
    }
    if (theme === 'light') return DEFAULT_THEME;
    return adapt(theme);
  }, [theme, systemDark]);

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}
