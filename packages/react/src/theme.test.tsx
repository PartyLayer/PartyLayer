/**
 * Theme-family tests: the five professional families (midnight, slate, teal, gold,
 * warm), each with a light and a dark variant. Asserts every named theme has the
 * right mode and a full set of color tokens, is callable (overrides apply while the
 * rest stays intact, like lightTheme/darkTheme), and that the `themes` catalog maps
 * to the matching named themes. The default theme is left untouched (checked too).
 */
import { describe, it, expect } from 'vitest';
import {
  lightTheme,
  darkTheme,
  midnightLightTheme,
  midnightDarkTheme,
  slateLightTheme,
  slateDarkTheme,
  tealLightTheme,
  tealDarkTheme,
  goldLightTheme,
  goldDarkTheme,
  warmLightTheme,
  warmDarkTheme,
  themes,
  type CallableTheme,
} from './theme';

const REQUIRED_COLOR_KEYS = [
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
] as const;

const LIGHT: Array<[string, CallableTheme]> = [
  ['midnightLightTheme', midnightLightTheme],
  ['slateLightTheme', slateLightTheme],
  ['tealLightTheme', tealLightTheme],
  ['goldLightTheme', goldLightTheme],
  ['warmLightTheme', warmLightTheme],
];

const DARK: Array<[string, CallableTheme]> = [
  ['midnightDarkTheme', midnightDarkTheme],
  ['slateDarkTheme', slateDarkTheme],
  ['tealDarkTheme', tealDarkTheme],
  ['goldDarkTheme', goldDarkTheme],
  ['warmDarkTheme', warmDarkTheme],
];

describe('professional theme families', () => {
  it('sets mode correctly on every variant', () => {
    for (const [, theme] of LIGHT) expect(theme.mode).toBe('light');
    for (const [, theme] of DARK) expect(theme.mode).toBe('dark');
  });

  it('has all required color tokens present (no undefined) on every variant', () => {
    for (const [name, theme] of [...LIGHT, ...DARK]) {
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(theme.colors[key], `${name}.colors.${key}`).toBeTruthy();
      }
      // Shape parity with the default bases.
      expect(theme.borderRadius, `${name}.borderRadius`).toBe(lightTheme.borderRadius);
      expect(theme.fontFamily, `${name}.fontFamily`).toBe(lightTheme.fontFamily);
      expect(theme.overlayBlur, `${name}.overlayBlur`).toBe(lightTheme.overlayBlur);
    }
  });

  it('is callable: an override applies while the rest of the palette stays intact', () => {
    const base = midnightDarkTheme; // usable as a plain object
    const customized = midnightDarkTheme({ borderRadius: 'large' });
    // The override applied ('large' resolves to 16px via the radius scale).
    expect(customized.borderRadius).toBe('16px');
    // The base object was not mutated.
    expect(base.borderRadius).toBe(lightTheme.borderRadius);
    // Everything else is preserved.
    expect(customized.mode).toBe('dark');
    expect(customized.colors.primary).toBe(base.colors.primary);
    expect(customized.colors.background).toBe(base.colors.background);
  });

  it('applies an accent override through the same applyOverrides path', () => {
    const customized = goldDarkTheme({ accentColor: '#123456' });
    expect(customized.colors.primary).toBe('#123456');
    // Non-accent tokens are untouched.
    expect(customized.colors.background).toBe(goldDarkTheme.colors.background);
  });

  it('exposes the exact verified palette (spot check)', () => {
    expect(midnightLightTheme.colors.primary).toBe('#1E3A8A');
    expect(midnightDarkTheme.colors.background).toBe('#0C1120');
    expect(tealLightTheme.colors.primary).toBe('#0D9488');
    expect(goldDarkTheme.colors.primary).toBe('#FBBF24');
    expect(warmLightTheme.colors.primary).toBe('#BE123C');
  });
});

describe('themes catalog', () => {
  it('maps each family to the matching named light/dark themes', () => {
    expect(themes.default.light).toBe(lightTheme);
    expect(themes.default.dark).toBe(darkTheme);
    expect(themes.midnight.light).toBe(midnightLightTheme);
    expect(themes.midnight.dark).toBe(midnightDarkTheme);
    expect(themes.slate.light).toBe(slateLightTheme);
    expect(themes.slate.dark).toBe(slateDarkTheme);
    expect(themes.teal.light).toBe(tealLightTheme);
    expect(themes.teal.dark).toBe(tealDarkTheme);
    expect(themes.gold.light).toBe(goldLightTheme);
    expect(themes.gold.dark).toBe(goldDarkTheme);
    expect(themes.warm.light).toBe(warmLightTheme);
    expect(themes.warm.dark).toBe(warmDarkTheme);
  });

  it('covers six families, each with a light and dark variant', () => {
    const keys = Object.keys(themes);
    expect(keys).toEqual(['default', 'midnight', 'slate', 'teal', 'gold', 'warm']);
    for (const key of keys) {
      expect(themes[key as keyof typeof themes].light.mode).toBe('light');
      expect(themes[key as keyof typeof themes].dark.mode).toBe('dark');
    }
  });
});
