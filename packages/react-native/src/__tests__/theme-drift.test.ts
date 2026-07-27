/**
 * Theme drift guard.
 *
 * The RN theme data in theme-data.ts is a manual copy of packages/react/src/theme.tsx,
 * because importing the web module would pull in DOM code. This test is the only thing
 * preventing silent divergence: it reads the web theme file and asserts every family's
 * color values, the family names, and the accent presets match the RN copy. When it
 * fails, its message says exactly what to do.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { themes, accentPresets } from '../theme-data';

const here = dirname(fileURLToPath(import.meta.url));
const webThemePath = resolve(here, '../../../react/src/theme.tsx');
const web = readFileSync(webThemePath, 'utf-8');

const FIX = `Update packages/react-native/src/theme-data.ts to match packages/react/src/theme.tsx.`;

/**
 * The web const backing each family and mode, DERIVED from the web source rather than
 * hardcoded, so a new family added to packages/react/src/theme.tsx is caught here
 * automatically instead of being silently skipped. We read the `export const themes`
 * map (family to its light and dark theme consts) and follow each theme const back to
 * the base it renders through its `makeCallableTheme(<base>)` declaration.
 */
function deriveWebFamilies(): Record<string, { light: string; dark: string }> {
  const themeToBase: Record<string, string> = {};
  for (const m of web.matchAll(/const (\w+): CallableTheme = makeCallableTheme\((\w+)\)/g)) {
    themeToBase[m[1]] = m[2];
  }
  const start = web.indexOf('export const themes = {');
  expect(start, `web themes export not found. ${FIX}`).toBeGreaterThan(-1);
  const block = web.slice(start, web.indexOf('} as const;', start));
  const families: Record<string, { light: string; dark: string }> = {};
  for (const m of block.matchAll(/(\w+):\s*\{\s*light:\s*(\w+),\s*dark:\s*(\w+)\s*\}/g)) {
    const light = themeToBase[m[2]];
    const dark = themeToBase[m[3]];
    expect(light, `web light base for family ${m[1]} not resolved. ${FIX}`).toBeTruthy();
    expect(dark, `web dark base for family ${m[1]} not resolved. ${FIX}`).toBeTruthy();
    families[m[1]] = { light, dark };
  }
  return families;
}

const CONST_NAMES = deriveWebFamilies();

/** Resolve the few token references the web file uses inside color values. */
const DEFAULT_FOREGROUND = (/const DEFAULT_FOREGROUND = '([^']+)'/.exec(web) ?? [])[1];

function stripValue(raw: string): string {
  const v = raw.trim();
  if (v === 'DEFAULT_FOREGROUND') return DEFAULT_FOREGROUND;
  return v.replace(/^'/, '').replace(/'$/, '');
}

/** Extract the `colors` object of a named web theme const. */
function extractWebColors(constName: string): Record<string, string> {
  const start = web.indexOf(`const ${constName}: PartyLayerTheme = {`);
  expect(start, `web theme const ${constName} not found. ${FIX}`).toBeGreaterThan(-1);
  const colorsIdx = web.indexOf('colors: {', start);
  const end = web.indexOf('}', colorsIdx);
  const block = web.slice(colorsIdx + 'colors: {'.length, end);
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = /^\s*(\w+):\s*(.+),\s*$/.exec(line);
    if (m) out[m[1]] = stripValue(m[2]);
  }
  return out;
}

describe('theme drift vs packages/react/src/theme.tsx', () => {
  it('covers exactly the families the web theme defines (derived, not hardcoded)', () => {
    expect(Object.keys(themes).sort(), FIX).toEqual(Object.keys(CONST_NAMES).sort());
    const variants = Object.values(themes).flatMap((p) => [p.light, p.dark]);
    expect(variants, FIX).toHaveLength(Object.keys(CONST_NAMES).length * 2);
  });

  it('every color value matches the web copy across all twelve variants', () => {
    for (const [family, modes] of Object.entries(CONST_NAMES)) {
      for (const mode of ['light', 'dark'] as const) {
        const webColors = extractWebColors(modes[mode]);
        const rnColors = themes[family as keyof typeof themes][mode].colors as Record<string, string>;
        for (const [key, webValue] of Object.entries(webColors)) {
          expect(rnColors[key], `${family}.${mode}.${key} drifted from the web theme. ${FIX}`).toBe(webValue);
        }
      }
    }
  });

  it('accent presets match the web copy', () => {
    for (const [name, preset] of Object.entries(accentPresets)) {
      const re = new RegExp(`${name}:\\s*\\{\\s*accentColor:\\s*'([^']+)',\\s*accentColorForeground:\\s*'([^']+)'`);
      const m = re.exec(web);
      expect(m, `web accent preset ${name} not found. ${FIX}`).not.toBeNull();
      expect(preset.accentColor, `accent preset ${name}.accentColor drifted. ${FIX}`).toBe(m![1]);
      expect(preset.accentColorForeground, `accent preset ${name}.accentColorForeground drifted. ${FIX}`).toBe(m![2]);
    }
  });
});
