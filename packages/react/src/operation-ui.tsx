import type { CSSProperties } from 'react';
import type { PartyLayerTheme } from './theme';

/** Internal visual primitives; optional operation UI stays outside the connect entry. */
export function operationUI(theme: PartyLayerTheme) {
  const base: CSSProperties = { boxSizing: 'border-box', minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' };
  return {
    card: { ...base, width: '100%', padding: 'clamp(20px, 4vw, 28px)', border: `1px solid ${theme.colors.border}`,
      borderRadius: 20, background: theme.colors.background, color: theme.colors.text, fontFamily: theme.fontFamily,
      fontSize: 14, lineHeight: 1.5, boxShadow: theme.mode === 'light' ? '0 4px 24px rgba(11, 15, 26, 0.035)' : 'none' } as CSSProperties,
    heading: { margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: '-.025em', lineHeight: 1.3 } as CSSProperties,
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.colors.textSecondary, marginBottom: 8 } as CSSProperties,
    input: { ...base, width: '100%', minHeight: 48, padding: '13px 14px', border: `1px solid ${theme.colors.border}`,
      borderRadius: 12, background: theme.colors.surface, color: theme.colors.text, font: 'inherit', fontSize: 16 } as CSSProperties,
    button: { ...base, minHeight: 46, padding: '12px 18px', borderWidth: 1, borderStyle: 'solid', borderColor: theme.colors.border, borderRadius: 12,
      background: theme.colors.surface, color: theme.colors.text, font: 'inherit', fontWeight: 600, lineHeight: 1.4,
      whiteSpace: 'normal', cursor: 'pointer', textAlign: 'center' } as CSSProperties,
    primary: { background: theme.colors.primary, color: theme.colors.primaryForeground ?? theme.colors.text,
      borderColor: 'transparent' } as CSSProperties,
    mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
      lineHeight: 1.65, overflowWrap: 'anywhere' } as CSSProperties,
    row: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '12px 0', borderBottom: `1px solid ${theme.colors.border}`, minWidth: 0 } as CSSProperties,
    note: { margin: '16px 0 0', padding: '12px 14px', borderRadius: 12, background: theme.colors.surface,
      fontSize: 13, lineHeight: 1.6, overflowWrap: 'anywhere' } as CSSProperties,
  };
}

export function OperationIcon({ kind }: { kind: 'send' | 'inbox' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    {kind === 'send' ? <><path d="m7 17 10-10M7 7h10v10" /></> : <><path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" /></>}
  </svg>;
}
