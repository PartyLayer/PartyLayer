import { createContext, useContext } from 'react';
import type { DemoPartyKey } from '../lib/types';
import type { TokenizationBackend } from '../lib/backend';

/**
 * The demo context threads the current demo party, the backend, and the theme mode
 * to every section. The current party is app state (a demo-party switcher), SEPARATE
 * from the wallet session: it selects whose data the sections read and who acts.
 */
export interface DemoContextValue {
  party: DemoPartyKey;
  setParty: (party: DemoPartyKey) => void;
  backend: TokenizationBackend;
  mode: 'light' | 'dark';
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider = DemoContext.Provider;

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within a DemoProvider.');
  return ctx;
}

/**
 * Party-scoped query key. Every hook folds the current party into its cache key so
 * switching parties never shows another party's cached data. The `scope` names the
 * section (holdings, incoming, ...).
 */
export function partyKey(scope: string, party: DemoPartyKey): [string, string, DemoPartyKey] {
  return ['tokenization', scope, party];
}
