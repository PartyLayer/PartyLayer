import type { PartyLayerLocale } from '../localization';

/** Native names identify languages without equating languages to national flags. */
export const partyLayerLocales: readonly { locale: PartyLayerLocale; name: string; nativeName: string; direction: 'ltr' | 'rtl' }[] = [
  { locale: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { locale: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr' },
  { locale: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
  { locale: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
  { locale: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
  { locale: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
  { locale: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
  { locale: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
  { locale: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
  { locale: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
  { locale: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr' },
  { locale: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
  { locale: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
  { locale: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr' },
];
