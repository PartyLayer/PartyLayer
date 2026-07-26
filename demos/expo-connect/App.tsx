/**
 * PartyLayer Expo connect demo (phase C1).
 *
 * The first REAL runtime of the React Native package: phases A, B1, and B2 were all
 * tested with the RN modules mocked. This app runs the actual ConnectButton and
 * WalletList from the ./ui entrypoint on a device or simulator, against local builds of
 * our packages.
 *
 * Honest scope: this proves the UI, the live registry fetch, the theme, the icon
 * rendering, and the deep link launch. Completing an end to end connect additionally
 * requires a Canton wallet app installed on the device, which a demo cannot assume. A
 * connect that cannot complete renders the error path honestly; nothing here fakes a
 * successful connect.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as core from '@partylayer/core';
import {
  createReactNativeClient,
  createReactNativeDeepLinkPlatform,
  toReactNativeTheme,
  themes,
  useWallets,
} from '@partylayer/react-native';
import { ConnectButton } from '@partylayer/react-native/ui';
import { createAsyncStorage as createDefaultAsyncStorage } from '@partylayer/react-native/async-storage';

const theme = toReactNativeTheme(themes.default.dark);

// Whether the loaded core is the local build (with the phase A deep link additions)
// rather than the npm 0.11.0 copy that lacks them. Shown in the debug panel.
const CORE_HAS_DEEPLINK = typeof (core as { createBrowserDeepLinkPlatform?: unknown }).createBrowserDeepLinkPlatform === 'function';

// The two previously bundler-invisible paths, now exercised with NO argument: the deep
// link platform defaults to a static react-native import, and the async-storage subpath
// statically imports the package. Both must resolve rather than throw.
function checkNoArgDeepLink(): string {
  try {
    const p = createReactNativeDeepLinkPlatform();
    return typeof p.openUrl === 'function' ? 'resolved (no argument)' : 'unexpected shape';
  } catch (e) {
    return 'threw: ' + (e instanceof Error ? e.message : String(e));
  }
}
function checkNoArgAsyncStorage(): string {
  try {
    const s = createDefaultAsyncStorage();
    return typeof s.getItem === 'function' ? 'resolved (no argument)' : 'unexpected shape';
  } catch (e) {
    return 'threw: ' + (e instanceof Error ? e.message : String(e));
  }
}
const NO_ARG_DEEPLINK = checkNoArgDeepLink();
const NO_ARG_ASYNC_STORAGE = checkNoArgAsyncStorage();

function DebugPanel({ client }: { client: ReturnType<typeof createReactNativeClient> }) {
  const { wallets, walletIcons, isLoading, isError, error } = useWallets(client);
  // The RN deep link platform from phase A, built on React Native's Linking.
  const deepLinkPlatform = useMemo(() => createReactNativeDeepLinkPlatform(Linking), []);

  return (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.h2, { color: theme.colors.text }]}>Debug</Text>

      <Row label="core loaded" value={CORE_HAS_DEEPLINK ? 'local build (DeepLinkPlatform present)' : 'REGISTRY copy (missing DeepLinkPlatform)'} ok={CORE_HAS_DEEPLINK} />
      <Row label="deep link platform" value={deepLinkPlatform ? 'built on RN Linking' : 'unavailable'} ok={!!deepLinkPlatform} />
      <Row label="deep link (no arg)" value={NO_ARG_DEEPLINK} ok={NO_ARG_DEEPLINK.startsWith('resolved')} />
      <Row label="async storage (no arg)" value={NO_ARG_ASYNC_STORAGE} ok={NO_ARG_ASYNC_STORAGE.startsWith('resolved')} />
      <Row label="registry" value={isLoading ? 'loading...' : isError ? `error: ${error?.message ?? ''}` : `${wallets?.length ?? 0} wallets`} ok={!isError} />

      <Text style={[styles.h3, { color: theme.colors.textSecondary }]}>Wallets and icon formats</Text>
      {(walletIcons ?? []).map((w) => (
        <View key={w.walletId} style={styles.walletRow}>
          <Text style={[styles.wallet, { color: theme.colors.text }]}>{w.walletId}</Text>
          <Text style={[styles.format, { color: theme.colors.textSecondary }]}>
            {w.format}
            {w.format === 'unknown' ? ' (neutral fallback)' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: ok ? theme.colors.success : theme.colors.error }]}>{value}</Text>
    </View>
  );
}

export default function App() {
  const client = useMemo(
    () =>
      createReactNativeClient({
        network: 'devnet',
        app: { name: 'PartyLayer Expo Connect Demo' },
        asyncStorage: AsyncStorage,
      }),
    [],
  );

  return (
    <View style={[styles.app, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: theme.colors.text }]}>PartyLayer connect</Text>
        <Text style={[styles.scope, { color: theme.colors.textSecondary }]}>
          This demo runs the real React Native connect UI against local package builds. It proves the
          UI, the registry fetch, the theme, the icon rendering, and the deep link launch. Completing a
          connect also needs a Canton wallet app installed; without one, the deep link launch is the
          observable outcome and any failure renders honestly.
        </Text>

        <View style={styles.buttonWrap}>
          <ConnectButton client={client} theme={theme} />
        </View>

        <DebugPanel client={client} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  h3: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  scope: { fontSize: 13, lineHeight: 19 },
  buttonWrap: { marginTop: 8 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  wallet: { fontSize: 13, fontFamily: 'monospace' },
  format: { fontSize: 13 },
});
