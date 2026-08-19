/**
 * PartyLayer Expo connect demo.
 *
 * Runs the real ConnectButton and WalletList from the ./ui entrypoint against local
 * builds of our packages, on a device, a simulator, or the web target.
 *
 * Written in the provider style: PartyLayerProvider and ThemeProvider at the root, and the
 * components and hooks below take no client and no theme. `asyncStorage` on the provider is
 * what makes the session survive an app restart, which on React Native it otherwise does
 * not, because the session store falls back to in-memory without it.
 *
 * What it shows: the wallet list built from a live registry fetch, the connect flow UI
 * (the connecting state, the error state, and retry), the theme from the bridge, the
 * per-wallet icon rendering, and the live account from the session store. A connect that
 * cannot complete renders the error path; nothing here fakes a successful connect.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createReactNativeClient,
  createReactNativeDeepLinkPlatform,
  toReactNativeTheme,
  themes,
  useWallets,
  useAccount,
  PartyLayerProvider,
  ThemeProvider,
} from '@partylayer/react-native';
import { ConnectButton } from '@partylayer/react-native/ui';
import { createAsyncStorage as createDefaultAsyncStorage } from '@partylayer/react-native/async-storage';

const theme = toReactNativeTheme(themes.default.dark);

// Module scope, so the client identity is stable across renders.
const client = createReactNativeClient({
  network: 'devnet',
  app: { name: 'PartyLayer Expo Connect Demo' },
  asyncStorage: AsyncStorage,
});

// The two previously bundler-invisible paths, exercised with NO argument: the deep link
// platform defaults to a static react-native import, and the async-storage subpath
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

function DebugPanel() {
  // No client argument: it comes from the provider.
  const { wallets, walletIcons, isLoading, isError, error } = useWallets();
  const { party, status } = useAccount();

  return (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.h2, { color: theme.colors.text }]}>Debug</Text>

      <Row label="deep link factory (no arg)" value={NO_ARG_DEEPLINK} ok={NO_ARG_DEEPLINK.startsWith('resolved')} />
      <Row label="async storage (no arg)" value={NO_ARG_ASYNC_STORAGE} ok={NO_ARG_ASYNC_STORAGE.startsWith('resolved')} />
      <Row label="registry" value={isLoading ? 'loading...' : isError ? `error: ${error?.message ?? ''}` : `${wallets?.length ?? 0} wallets`} ok={!isError} />
      <Row label="session status" value={status} ok={status !== 'disconnected'} />
      <Row label="party" value={party ?? 'none'} ok={!!party} />

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

function Screen() {
  return (
    <View style={[styles.app, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: theme.colors.text }]}>PartyLayer connect</Text>
        <Text style={[styles.scope, { color: theme.colors.textSecondary }]}>
          This demo runs the real React Native connect UI against local package builds. It shows the
          wallet list from a live registry fetch, the connect flow UI, the theme, the icon rendering,
          and the live account from the session store, which persists through AsyncStorage. A connect
          that cannot complete renders the error path.
        </Text>

        <View style={styles.buttonWrap}>
          {/* No client and no theme: both come from the providers below. */}
          <ConnectButton />
        </View>

        <DebugPanel />
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    // `asyncStorage` is what persists the session across an app restart.
    <PartyLayerProvider client={client} asyncStorage={AsyncStorage}>
      <ThemeProvider theme={theme}>
        <Screen />
      </ThemeProvider>
    </PartyLayerProvider>
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
