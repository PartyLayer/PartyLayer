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
  applyAccent,
  accentPresets,
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

describe('accent overrides', () => {
  it('ships the seven presets', () => {
    expect(Object.keys(accentPresets).sort()).toEqual(
      ['blue', 'green', 'orange', 'partyYellow', 'pink', 'purple', 'red'].sort(),
    );
  });

  it('applies an accent preset: sets primary and its foreground, derives a distinct hover', () => {
    const themed = applyAccent(themes.default.dark, accentPresets.blue);
    expect(themed.colors.primary).toBe('#3B82F6');
    expect(themed.colors.primaryForeground).toBe('#0B0F1A');
    expect(themed.colors.primaryHover).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(themed.colors.primaryHover).not.toBe(themed.colors.primary);
  });

  it('auto-derives the foreground when only an accent color is given', () => {
    const light = applyAccent(themes.default.light, { accentColor: '#FFFFFF' });
    expect(light.colors.primary).toBe('#FFFFFF');
    expect(light.colors.primaryForeground).toBe('#0B0F1A'); // dark text on a light accent
  });

  it('does not mutate the input theme', () => {
    const before = themes.default.light.colors.primary;
    applyAccent(themes.default.light, { accentColor: '#123456' });
    expect(themes.default.light.colors.primary).toBe(before);
  });
});

// Independent WCAG luminance check for the native normal/pressed accent pair.
function contrastRatio(a: string | undefined, b: string): number {
  if (!a) throw new Error('Missing foreground');
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255);
    const c = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

it('keeps native preset and custom accent text readable while pressed', () => {
  for (const base of [themes.default.light, themes.default.dark]) {
    const overrides = [
      ...Object.values(accentPresets),
      ...['#3B82F6', '#EC4899', '#808080', '#777777', '#F97316'].map((accentColor) => ({ accentColor })),
    ];
    for (const value of overrides) {
      const c = applyAccent(base, value).colors;
      expect(contrastRatio(c.primaryForeground, c.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.primaryForeground, c.primaryHover)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
