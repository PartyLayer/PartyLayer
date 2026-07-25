/**
 * Theme bridge tests: colors pass through unchanged for all twelve family variants,
 * borderRadius parses px and rem and falls back sensibly, the overlay adaptation is
 * deterministic, and the pressed color is exposed. RN modules are not needed here (the
 * bridge is pure data).
 */
import { describe, it, expect } from 'vitest';
import {
  toReactNativeTheme,
  parseBorderRadius,
  themes,
  REM_BASE_PX,
  DEFAULT_BORDER_RADIUS,
} from '../theme';
import type { PartyLayerTheme } from '../theme-data';

const ALL_VARIANTS: Array<[string, PartyLayerTheme]> = Object.entries(themes).flatMap(([family, pair]) => [
  [`${family}.light`, pair.light],
  [`${family}.dark`, pair.dark],
]);

const COLOR_KEYS: Array<keyof PartyLayerTheme['colors']> = [
  'primary',
  'primaryHover',
  'primaryForeground',
  'background',
  'surface',
  'text',
  'textSecondary',
  'border',
  'success',
  'successBg',
  'error',
  'errorBg',
  'warning',
  'warningBg',
  'overlay',
];

describe('color pass-through', () => {
  it('keeps every color key verbatim across all twelve variants', () => {
    expect(ALL_VARIANTS).toHaveLength(12);
    for (const [name, theme] of ALL_VARIANTS) {
      const rn = toReactNativeTheme(theme);
      for (const key of COLOR_KEYS) {
        expect(rn.colors[key], `${name}.${String(key)}`).toBe(theme.colors[key]);
      }
    }
  });
});

describe('parseBorderRadius', () => {
  it('parses px', () => {
    expect(parseBorderRadius('10px')).toBe(10);
    expect(parseBorderRadius('0px')).toBe(0);
    expect(parseBorderRadius('16.5px')).toBe(16.5);
  });
  it('parses rem using the documented rem base', () => {
    expect(REM_BASE_PX).toBe(16);
    expect(parseBorderRadius('1rem')).toBe(16);
    expect(parseBorderRadius('0.5rem')).toBe(8);
  });
  it('accepts a bare number', () => {
    expect(parseBorderRadius('12')).toBe(12);
  });
  it('falls back for unparseable values', () => {
    expect(parseBorderRadius('12pt')).toBe(DEFAULT_BORDER_RADIUS);
    expect(parseBorderRadius('50%')).toBe(DEFAULT_BORDER_RADIUS);
    expect(parseBorderRadius('auto')).toBe(DEFAULT_BORDER_RADIUS);
    expect(parseBorderRadius('')).toBe(DEFAULT_BORDER_RADIUS);
  });
  it('converts the default theme radius to a number', () => {
    expect(toReactNativeTheme(themes.default.light).borderRadius).toBe(10);
  });
});

describe('overlay and pressed adaptations', () => {
  it('drops overlayBlur and uses the source overlay color deterministically', () => {
    const light = toReactNativeTheme(themes.default.light);
    expect(light.overlay).toBe(themes.default.light.colors.overlay);
    // Deterministic: same input, same output; no blur field on the result.
    expect(light.overlay).toBe(toReactNativeTheme(themes.default.light).overlay);
    expect('overlayBlur' in light).toBe(false);
  });

  it('exposes primaryHover as the pressed color', () => {
    for (const [name, theme] of ALL_VARIANTS) {
      expect(toReactNativeTheme(theme).colors.pressed, name).toBe(theme.colors.primaryHover);
    }
  });
});
