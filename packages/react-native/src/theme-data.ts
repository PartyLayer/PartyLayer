/**
 * Theme data, copied from @partylayer/react's theme module.
 *
 * The source theme module (packages/react/src/theme.tsx) is pure structured data, BUT
 * it is only reachable through the react package's `.` entrypoint, which pulls in the
 * DOM components, and the module itself reads a browser media query for auto dark mode.
 * So the data is copied here verbatim rather than imported, to keep this package free
 * of any DOM dependency. Colors, radius, font, and blur are identical to the source;
 * when the source palettes change, mirror them here.
 */

/** The token object every family variant produces (same shape as the react package). */
export interface PartyLayerTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    primaryHover: string;
    primaryForeground?: string;
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
  overlayBlur?: string;
}

const DEFAULT_FONT =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
const DEFAULT_RADIUS = '10px';
const DEFAULT_BLUR = '5px';
const DEFAULT_FOREGROUND = '#0B0F1A';

const lightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
    primaryForeground: DEFAULT_FOREGROUND,
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
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const darkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FFCC00',
    primaryHover: '#E6B800',
    primaryForeground: DEFAULT_FOREGROUND,
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
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const midnightLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#1E3A8A',
    primaryHover: '#1E40AF',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#475569',
    border: 'rgba(15, 23, 42, 0.10)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(15, 23, 42, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const midnightDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#3B82F6',
    primaryHover: '#60A5FA',
    primaryForeground: '#0B0F1A',
    background: '#0C1120',
    surface: '#161E33',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const slateLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#475569',
    primaryHover: '#334155',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: 'rgba(30, 41, 59, 0.10)',
    success: '#10B981',
    successBg: '#ECFDF5',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    overlay: 'rgba(30, 41, 59, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const slateDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#94A3B8',
    primaryHover: '#CBD5E1',
    primaryForeground: '#0F172A',
    background: '#0F1729',
    surface: '#1E293B',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const tealLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F0FDFA',
    text: '#134E4A',
    textSecondary: '#5F6B6A',
    border: 'rgba(19, 78, 74, 0.12)',
    success: '#10B981',
    successBg: '#ECFDF5',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    overlay: 'rgba(19, 78, 74, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const tealDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#2DD4BF',
    primaryHover: '#5EEAD4',
    primaryForeground: '#0B0F1A',
    background: '#0A1414',
    surface: '#152525',
    text: '#F0FDFA',
    textSecondary: '#8FA8A6',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const goldLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#B45309',
    primaryHover: '#92400E',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#FEFCE8',
    text: '#1C1917',
    textSecondary: '#57534E',
    border: 'rgba(28, 25, 23, 0.12)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(28, 25, 23, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const goldDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FBBF24',
    primaryHover: '#FCD34D',
    primaryForeground: '#1C1917',
    background: '#0C0A09',
    surface: '#1C1917',
    text: '#FAFAF9',
    textSecondary: '#A8A29E',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const warmLightBase: PartyLayerTheme = {
  mode: 'light',
  colors: {
    primary: '#BE123C',
    primaryHover: '#9F1239',
    primaryForeground: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#FFF1F2',
    text: '#1F1315',
    textSecondary: '#6B5658',
    border: 'rgba(31, 19, 21, 0.12)',
    success: '#059669',
    successBg: '#ECFDF5',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    overlay: 'rgba(31, 19, 21, 0.25)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

const warmDarkBase: PartyLayerTheme = {
  mode: 'dark',
  colors: {
    primary: '#FB7185',
    primaryHover: '#FDA4AF',
    primaryForeground: '#1F1315',
    background: '#140E0F',
    surface: '#241819',
    text: '#FDF2F3',
    textSecondary: '#B0999B',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#34D399',
    successBg: '#052E1A',
    error: '#F87171',
    errorBg: '#450A0A',
    warning: '#FBBF24',
    warningBg: '#422006',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  borderRadius: DEFAULT_RADIUS,
  fontFamily: DEFAULT_FONT,
  overlayBlur: DEFAULT_BLUR,
};

/** The six families, each with a light and a dark variant (twelve variants total). */
export const themes = {
  default: { light: lightBase, dark: darkBase },
  midnight: { light: midnightLightBase, dark: midnightDarkBase },
  slate: { light: slateLightBase, dark: slateDarkBase },
  teal: { light: tealLightBase, dark: tealDarkBase },
  gold: { light: goldLightBase, dark: goldDarkBase },
  warm: { light: warmLightBase, dark: warmDarkBase },
} as const;

/** A family name in the {@link themes} catalog. */
export type ThemeFamily = keyof typeof themes;
