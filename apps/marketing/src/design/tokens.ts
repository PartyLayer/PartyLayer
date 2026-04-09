/**
 * Design tokens for PartyLayer marketing site
 * These values are mirrored in tailwind.config.ts for utility classes
 */

export const colors = {
  // Base
  bg: '#FFFFFF',
  fg: '#0B0F1A',
  muted: '#F5F6F8',
  'muted-2': '#EEF0F4',
  border: 'rgba(15, 23, 42, 0.10)',

  // Brand (Premium Yellow)
  brand: {
    50: '#FFFBEB',
    100: '#FFF5CC',
    500: '#FFCC00',
    600: '#E6B800',
  },

  // Neutrals
  slate: {
    300: '#CBD5E1',
    500: '#64748B',
    700: '#334155',
    900: '#0B0F1A',
  },
} as const;

export const typography = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',

  sizes: {
    h1: { size: '3.25rem', lineHeight: '1.1', letterSpacing: '-0.02em', weight: '700' },
    'h1-mobile': { size: '2.5rem', lineHeight: '1.15', letterSpacing: '-0.02em', weight: '700' },
    h2: { size: '2rem', lineHeight: '1.2', letterSpacing: '-0.015em', weight: '700' },
    h3: { size: '1.25rem', lineHeight: '1.4', weight: '600' },
    body: { size: '1rem', lineHeight: '1.6', weight: '400' },
    small: { size: '0.875rem', lineHeight: '1.5', weight: '400' },
  },
} as const;

export const radius = {
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
} as const;

export const shadows = {
  card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03)',
  'card-hover': '0 2px 8px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
  button: '0 1px 2px rgba(15, 23, 42, 0.05)',
  'button-hover': '0 2px 4px rgba(15, 23, 42, 0.08)',
  modal: '0 4px 16px rgba(15, 23, 42, 0.08), 0 16px 48px rgba(15, 23, 42, 0.12)',
} as const;

export const motion = {
  duration: {
    hover: '150ms',
    modal: '220ms',
  },
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

// Wallet metadata (from registry/wallets.json)
export const wallets = [
  {
    id: 'console',
    name: 'Console Wallet',
    description: 'Official Console Wallet for Canton Network',
    transport: 'Extension + Mobile',
    logo: '/wallets/console.png',
    homepage: 'https://consolewallet.io',
  },
  {
    id: 'loop',
    name: '5N Loop',
    description: '5N Loop Wallet for Canton Network',
    transport: 'Deep link',
    logo: '/wallets/loop.svg',
    homepage: 'https://cantonloop.com',
  },
  {
    id: 'cantor8',
    name: 'Cantor8 (C8)',
    description: 'Cantor8 Wallet for Canton Network',
    transport: 'Popup',
    logo: '/wallets/cantor8.png',
    homepage: 'https://www.canton.network/ecosystem/cantor8',
  },
  {
    id: 'bron',
    name: 'Bron',
    description: 'Bron Wallet for Canton Network',
    transport: 'Deep link',
    logo: '/wallets/bron.png',
    homepage: 'https://developer.bron.org',
  },
] as const;

export type WalletId = (typeof wallets)[number]['id'];
