/**
 * Template registry. Each entry maps to a directory under `templates/<id>/`.
 * New templates (next-ssr, vue-nuxt-pinia, vanilla) are added here as they land.
 */
export interface TemplateMeta {
  /** Directory name under templates/ and the --template flag value. */
  id: string;
  /** Human label shown in the picker. */
  label: string;
  /** One-line hint shown next to the label. */
  hint: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'react-vite',
    label: 'React + Vite',
    hint: 'React 18, Vite, zero-config PartyLayerKit',
  },
  {
    id: 'next-ssr',
    label: 'Next.js (SSR)',
    hint: 'App Router, server-side session via cookieStorage',
  },
];

export function isTemplateId(value: string): boolean {
  return TEMPLATES.some((t) => t.id === value);
}
