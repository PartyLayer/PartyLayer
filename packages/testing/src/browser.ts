/**
 * Reusable browser-test primitives for a real-browser (Playwright) smoke —
 * framework-agnostic: every helper returns a STRING of JS to run via
 * `page.addInitScript(...)` / `page.evaluate(...)`, so this package takes NO
 * dependency on Playwright. The actual smoke lives in `apps/demo/e2e`.
 */

export interface MockWalletInjectionOptions {
  /** Key on `window.canton` the wallet registers under. Default `mock`. */
  walletId?: string;
  /** Primary party id the mock reports. Default `party::e2e-1`. */
  partyId?: string;
  /** CAIP-2 network id. Default `canton:da-devnet`. */
  networkId?: string;
}

/**
 * An init script that installs a minimal CIP-0103-shaped provider at
 * `window.canton[walletId]` BEFORE the app loads, so a real-browser test can
 * drive the connect flow with no extension/live wallet. Inject via
 * `page.addInitScript({ content: mockWalletInjectionScript() })`.
 */
export function mockWalletInjectionScript(options: MockWalletInjectionOptions = {}): string {
  const walletId = options.walletId ?? 'mock';
  const partyId = options.partyId ?? 'party::e2e-1';
  const networkId = options.networkId ?? 'canton:da-devnet';
  return `
(() => {
  const partyId = ${JSON.stringify(partyId)};
  const networkId = ${JSON.stringify(networkId)};
  let connected = false;
  const listeners = new Map();
  const emit = (e, ...a) => (listeners.get(e) || []).forEach((l) => l(...a));
  const account = {
    primary: true, partyId, status: 'allocated', hint: 'e2e',
    publicKey: 'pk', namespace: 'ns', networkId, signingProviderId: 'webauthn-prf',
  };
  const provider = {
    isPartyLayer: true,
    request: async ({ method }) => {
      switch (method) {
        case 'connect': connected = true;
          emit('statusChanged', { connection: { isConnected: true }, network: { networkId } });
          emit('accountsChanged', [account]); return { isConnected: true };
        case 'disconnect': connected = false;
          emit('statusChanged', { connection: { isConnected: false } }); return null;
        case 'status': return { connection: { isConnected: connected }, network: { networkId } };
        case 'listAccounts': return [account];
        case 'getActiveNetwork': return { networkId };
        default: return {};
      }
    },
    on: (e, l) => { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e).add(l); return provider; },
    removeListener: (e, l) => { (listeners.get(e) || new Set()).delete(l); return provider; },
  };
  window.canton = window.canton || {};
  window.canton[${JSON.stringify(walletId)}] = provider;
})();
`.trim();
}

/**
 * A script returning the number of object stores' total entries for an IndexedDB
 * database (or -1 if the DB does not exist) — used to assert encrypted-session
 * persistence engaged after a connect. Run via `page.evaluate(idbEntryCountScript(db))`.
 */
export function idbEntryCountScript(dbName: string): string {
  return `
(async () => {
  const name = ${JSON.stringify(dbName)};
  const exists = (await indexedDB.databases?.() || []).some((d) => d.name === name);
  if (!exists) return -1;
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  let total = 0;
  for (const store of Array.from(db.objectStoreNames)) {
    const count = await new Promise((res) => {
      const c = db.transaction(store, 'readonly').objectStore(store).count();
      c.onsuccess = () => res(c.result); c.onerror = () => res(0);
    });
    total += count;
  }
  db.close();
  return total;
})()
`.trim();
}

/** The origin-bound IndexedDB name the session key store uses for a given origin. */
export function sessionKeyDbName(origin: string): string {
  return `partylayer-session-key::${origin}`;
}
