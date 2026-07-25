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
export { themes, type ThemeFamily, accentPresets, type AccentPreset } from './theme-data';

// ─── Accent overrides (mirrors the react theme's accent capability) ──────────

/** Accent override options: the same accent tunables the web theme accepts. */
export interface AccentOverrides {
  /** Accent color: sets `colors.primary` (and derives `colors.primaryHover`). */
  accentColor?: string;
  /** Text/icon color on the accent. Auto-derived from `accentColor` when omitted. */
  accentColorForeground?: string;
}

/** Parse a 3 or 6 digit hex color into rgb, or null for any other format. */
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

/**
 * Apply an accent override to a theme, matching the react theme's behavior: set
 * `colors.primary`, derive `colors.primaryHover` (lighten in dark mode, darken in
 * light), and set `colors.primaryForeground` from `accentColorForeground` or the
 * accent's luminance. Returns a new theme; the input is not mutated. An
 * {@link AccentPreset} can be spread in as the overrides.
 */
export function applyAccent(theme: PartyLayerTheme, overrides: AccentOverrides): PartyLayerTheme {
  const next: PartyLayerTheme = { ...theme, colors: { ...theme.colors } };
  if (overrides.accentColor) {
    next.colors.primary = overrides.accentColor;
    next.colors.primaryHover = shade(overrides.accentColor, theme.mode === 'dark' ? 0.14 : -0.14);
    next.colors.primaryForeground = overrides.accentColorForeground ?? autoForeground(overrides.accentColor);
  }
  if (overrides.accentColorForeground) next.colors.primaryForeground = overrides.accentColorForeground;
  return next;
}

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
