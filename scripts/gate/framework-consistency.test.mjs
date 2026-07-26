/**
 * Framework consistency guard (gate:consistency).
 *
 * The three framework packages are NOT at parity, and this test does not pretend they
 * are. Measured from the api snapshots: @partylayer/react exposes 34 hook names (33
 * distinct; useCantonConnect aliases usePartyLayer), @partylayer/vue exposes 8, and
 * @partylayer/react-native exposes 2. The three-way symbol intersection is empty:
 * react and react-native share { useConnect, useWallets, ConnectButton }, react and vue
 * share a session/account/cost/token set, and vue and react-native share nothing.
 *
 * What all three genuinely expose is the one capability a wallet kit cannot omit:
 * connect a session and disconnect it. This test guards that shared surface from drifting
 * apart. It reads the committed api snapshots (no runtime, no renderer), so a change that
 * renames or drops connect or disconnect in any framework fails here. See
 * docs/production-checklist.md item 9 for the full parity matrix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SNAP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tooling', 'api-snapshots');

function blob(...files) {
  return files.map((f) => readFileSync(join(SNAP, f), 'utf8')).join('\n');
}

const react = blob('partylayer__react.api.d.ts', 'partylayer__react__query.api.d.ts');
const vue = blob('partylayer__vue.api.d.ts', 'partylayer__vue__pinia.api.d.ts');
const reactNative = blob(
  'partylayer__react-native.api.d.ts',
  'partylayer__react-native__ui.api.d.ts',
  'partylayer__react-native__async-storage.api.d.ts',
);

/** Pull one interface body out of a .d.ts blob by name. */
function iface(text, name) {
  const m = text.match(new RegExp(`interface ${name} \\{([^}]*)\\}`));
  return m ? m[1] : null;
}

test('all three frameworks expose a connect capability', () => {
  // react: the useConnect hook. react-native: the useConnect hook. vue: the session store.
  assert.match(react, /declare function useConnect\(/, 'react must export useConnect');
  assert.match(reactNative, /declare function useConnect\(/, 'react-native must export useConnect');
  const vueSession = iface(vue, 'UseSessionReturn');
  assert.ok(vueSession, 'vue must declare UseSessionReturn');
  assert.match(vueSession, /connect\s*\(/, 'vue useSession must expose connect');
});

test('all three frameworks expose a disconnect capability', () => {
  assert.match(react, /declare function useDisconnect\(/, 'react must export useDisconnect');
  const rnResult = iface(reactNative, 'UseConnectResult');
  assert.ok(rnResult, 'react-native must declare UseConnectResult');
  assert.match(rnResult, /disconnect\s*:/, 'react-native useConnect must expose disconnect');
  const vueSession = iface(vue, 'UseSessionReturn');
  assert.match(vueSession, /disconnect\s*\(/, 'vue useSession must expose disconnect');
});

test('disconnect has the same behavioral shape in all three: no args, returns Promise<void>', () => {
  // Normalize `disconnect: () => Promise<void>` and `disconnect(): Promise<void>` to one form.
  const canonical = 'disconnect()=>Promise<void>';
  const norm = (sig) => sig.replace(/\s+/g, '').replace('disconnect():', 'disconnect()=>').replace('disconnect:()=>', 'disconnect()=>');

  const reactSig = react.match(/disconnect:\s*\(\)\s*=>\s*Promise<void>/);
  const rnSig = reactNative.match(/disconnect:\s*\(\)\s*=>\s*Promise<void>/);
  const vueSig = vue.match(/disconnect\(\):\s*Promise<void>/);
  assert.ok(reactSig, 'react disconnect must be () => Promise<void>');
  assert.ok(rnSig, 'react-native disconnect must be () => Promise<void>');
  assert.ok(vueSig, 'vue disconnect must be (): Promise<void>');
  assert.equal(norm(reactSig[0]), canonical);
  assert.equal(norm(rnSig[0]), canonical);
  assert.equal(norm(vueSig[0]), canonical);
});

test('react and react-native keep their shared hook surface', () => {
  // The only hooks both expose. If either drops one, the shared surface drifted.
  for (const hook of ['useConnect', 'useWallets']) {
    assert.match(react, new RegExp(`declare function ${hook}\\(`), `react must export ${hook}`);
    assert.match(reactNative, new RegExp(`declare function ${hook}\\(`), `react-native must export ${hook}`);
  }
});
