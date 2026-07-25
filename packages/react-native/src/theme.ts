/**
 * Theme bridge: convert a PartyLayerTheme into a React Native ready theme.
 *
 * Colors pass through verbatim, because React Native accepts hex and rgba strings
 * directly. Three fields do not translate to React Native and are adapted, each
 * documented on the field it produces:
 * - borderRadius: a CSS length string becomes a number (React Native wants a number).
 * - overlayBlur: dropped, since core React Native has no backdrop blur; an opaque
 *   overlay color is derived from `colors.overlay` instead.
 * - primaryHover: web hover has no React Native equivalent, so it is exposed as a
 *   pressed color for Pressable states.
 */
import type { PartyLayerTheme } from './theme-data';

export type { PartyLayerTheme } from './theme-data';
export { themes, type ThemeFamily } from './theme-data';

/** The rem base used when parsing a `rem` border radius: 16px, the CSS default. */
export const REM_BASE_PX = 16;

/** The fallback border radius (number) used when a value cannot be parsed. */
export const DEFAULT_BORDER_RADIUS = 10;

/**
 * Parse a CSS length string into a number of density independent pixels.
 * Supports `px` and `rem` (using {@link REM_BASE_PX}); a bare number is taken as is.
 * Anything else falls back to {@link DEFAULT_BORDER_RADIUS}.
 */
export function parseBorderRadius(value: string): number {
  const trimmed = value.trim();
  const remMatch = /^(-?\d*\.?\d+)rem$/.exec(trimmed);
  if (remMatch) return parseFloat(remMatch[1]) * REM_BASE_PX;
  const pxMatch = /^(-?\d*\.?\d+)px$/.exec(trimmed);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const bare = /^(-?\d*\.?\d+)$/.exec(trimmed);
  if (bare) return parseFloat(bare[1]);
  return DEFAULT_BORDER_RADIUS;
}

/** A React Native ready theme derived from a {@link PartyLayerTheme}. */
export interface ReactNativeTheme {
  mode: 'light' | 'dark';
  /** The palette, verbatim from the source theme (hex and rgba pass through). */
  colors: PartyLayerTheme['colors'] & {
    /**
     * The color to show while a Pressable is pressed. Derived from the source
     * `primaryHover`, since React Native has press states rather than hover.
     */
    pressed: string;
  };
  /** The source `borderRadius` CSS length parsed into a number. */
  borderRadius: number;
  /** The source `fontFamily`, passed through unchanged. */
  fontFamily: string;
  /**
   * An opaque overlay color for a modal backdrop. React Native has no backdrop blur,
   * so the source `overlayBlur` is dropped and this is used instead; it is the source
   * `colors.overlay` verbatim (already an rgba scrim that reads as a dim backdrop).
   */
  overlay: string;
}

/**
 * Convert a {@link PartyLayerTheme} into a {@link ReactNativeTheme}. Colors are copied
 * unchanged; `borderRadius` is parsed to a number; `overlayBlur` is dropped in favor
 * of the opaque `overlay`; `primaryHover` is exposed as `colors.pressed`.
 */
export function toReactNativeTheme(theme: PartyLayerTheme): ReactNativeTheme {
  return {
    mode: theme.mode,
    colors: {
      ...theme.colors,
      pressed: theme.colors.primaryHover,
    },
    borderRadius: parseBorderRadius(theme.borderRadius),
    fontFamily: theme.fontFamily,
    overlay: theme.colors.overlay,
  };
}

/**
 * A StyleSheet-friendly view of a {@link ReactNativeTheme}: the flat token values a
 * consumer commonly reaches for, so they need no reshaping in a `StyleSheet.create`
 * call. It is a convenience over {@link toReactNativeTheme}; no components are built.
 */
export function toThemeTokens(theme: PartyLayerTheme): {
  colors: ReactNativeTheme['colors'];
  borderRadius: number;
  fontFamily: string;
  overlay: string;
} {
  const rn = toReactNativeTheme(theme);
  return {
    colors: rn.colors,
    borderRadius: rn.borderRadius,
    fontFamily: rn.fontFamily,
    overlay: rn.overlay,
  };
}
