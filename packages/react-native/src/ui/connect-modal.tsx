/**
 * ConnectModal: the whole connect flow in one component.
 *
 * Open, list the wallets, show loading, show a failure with a retry, and dismiss on
 * success. Client and theme are optional, so under `PartyLayerProvider` and `ThemeProvider`
 * this is `<ConnectModal visible={open} onClose={close} />` with nothing threaded through.
 *
 * A bottom sheet rather than a full screen: it is the idiomatic shape for a short chooser
 * on iOS and Android alike, it keeps the app visible behind the scrim so it reads as
 * dismissible, and it needs only a bottom inset, where a full screen sheet would also need
 * a correct top inset.
 *
 * No QR view: the web modal has one so a desktop user can scan with a phone, and on a phone
 * there is nothing to scan. Selecting a wallet calls `client.connect` with that wallet id,
 * and the registered adapter decides how it reaches its wallet.
 *
 * Every primitive here is part of react-native, so this adds no dependency. That is also
 * why safe area handling is an `insets` prop rather than a dependency: the core
 * `SafeAreaView` is deprecated and slated for removal, and react-native-safe-area-context
 * would be a new peer. An app that already has real insets passes them and is exact on any
 * device; an app that does not gets a conservative platform default.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { PartyLayerClient, WalletInfo } from '@partylayer/sdk';
import type { ReactNativeTheme } from '../theme';
import { useResolvedTheme } from '../theme-context';
import { useResolvedClient } from '../party-layer-context';
import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import { walletIconInfo } from '../icons';
import { WalletIcon } from './wallet-icon';
import { CloseIcon, ErrorIcon, Spinner } from './chrome-icons';

/** Safe area insets. Pass real values from your safe area source when you have them. */
export interface ConnectModalInsets {
  top?: number;
  bottom?: number;
}

/**
 * Conservative defaults for an app that supplies no insets: enough bottom padding to clear
 * the iOS home indicator on a notched device, and a smaller gap on Android.
 */
const DEFAULT_BOTTOM_INSET = Platform.OS === 'ios' ? 24 : 16;

/**
 * Whether the OS "reduce motion" setting is on, kept live.
 *
 * Used to drop the sheet's slide animation, which is a vestibular trigger.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => {
        // Unavailable on this platform: keep animations, which is the safe default.
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduced(enabled);
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

export interface ConnectModalProps {
  /** Omit to use the client from `PartyLayerProvider`. */
  client?: PartyLayerClient;
  /** Omit to use the theme from `ThemeProvider`, or the default theme. */
  theme?: ReactNativeTheme;
  visible: boolean;
  onClose: () => void;
  /** Safe area insets. Only `bottom` affects a bottom sheet. */
  insets?: ConnectModalInsets;
  testID?: string;
}

export function ConnectModal({
  client: explicitClient,
  theme: explicitTheme,
  visible,
  onClose,
  insets,
  testID,
}: ConnectModalProps) {
  const client = useResolvedClient(explicitClient);
  const theme = useResolvedTheme(explicitTheme);
  const { wallets, isLoading, isError, error, refetch } = useWallets(client);
  const { connect } = useConnect(client);
  const [connecting, setConnecting] = useState<WalletInfo | null>(null);
  const [connectError, setConnectError] = useState<Error | null>(null);
  const reducedMotion = useReducedMotion();

  // Reopening after a failure should start on the list, not on the previous error.
  useEffect(() => {
    if (!visible) {
      setConnecting(null);
      setConnectError(null);
    }
  }, [visible]);

  const startConnect = useCallback(
    (wallet: WalletInfo) => {
      setConnectError(null);
      setConnecting(wallet);
      connect({ walletId: String(wallet.walletId) } as never)
        .then(() => {
          setConnecting(null);
          onClose(); // Connected: dismiss; the button reflects the session.
        })
        .catch((err: unknown) => {
          // Keep `connecting` set so retry knows which wallet to reopen; the error branch
          // below takes priority over the connecting branch.
          setConnectError(err instanceof Error ? err : new Error(String(err)));
        });
    },
    [connect, onClose],
  );

  const panel = {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius,
    padding: 20,
    paddingBottom: 20 + (insets?.bottom ?? DEFAULT_BOTTOM_INSET),
    minHeight: 240,
  };
  const textStyle = { color: theme.colors.text, fontFamily: theme.fontFamily };
  const mutedStyle = { color: theme.colors.textSecondary, fontFamily: theme.fontFamily };

  let body;
  let liveMessage: string | undefined;
  if (connectError) {
    liveMessage = `Could not connect. ${connectError.message}`;
    body = (
      <View testID="state-error" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ErrorIcon color={theme.colors.error} />
        <Text style={[textStyle, { marginTop: 12, fontWeight: '600' }]}>Could not connect</Text>
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>{connectError.message}</Text>
        <Pressable
          testID="retry"
          accessibilityRole="button"
          accessibilityLabel="Retry connecting"
          onPress={() => {
            if (connecting) startConnect(connecting);
          }}
          style={({ pressed }: { pressed: boolean }) => ({
            marginTop: 20,
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: theme.borderRadius,
            backgroundColor: pressed ? theme.colors.pressed : theme.colors.primary,
          })}
        >
          <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.fontFamily }}>Retry</Text>
        </Pressable>
      </View>
    );
  } else if (connecting) {
    liveMessage = `Connecting to ${connecting.name}`;
    body = (
      <View testID="state-connecting" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Spinner color={theme.colors.primary} size="large" />
        <Text style={[textStyle, { marginTop: 16 }]}>Connecting to {connecting.name}</Text>
        {/* Says what is happening, without claiming an app switch that the adapter may
            never perform. How a wallet is reached is the adapter's business. */}
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>
          Waiting for the wallet to respond...
        </Text>
        <Pressable
          testID="cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel connecting"
          onPress={() => setConnecting(null)}
          style={{ marginTop: 20, padding: 10 }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fontFamily }}>Cancel</Text>
        </Pressable>
      </View>
    );
  } else if (isError) {
    liveMessage = 'Could not load wallets';
    body = (
      <View testID="state-list-error" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={[textStyle, { fontWeight: '600' }]}>Could not load wallets</Text>
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>{error?.message ?? ''}</Text>
        <Pressable
          testID="reload"
          accessibilityRole="button"
          accessibilityLabel="Try loading the wallets again"
          onPress={() => refetch()}
          style={{ marginTop: 20, padding: 10 }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fontFamily }}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (isLoading) {
    liveMessage = 'Loading wallets';
    body = (
      <View testID="state-loading" style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Spinner color={theme.colors.primary} size="large" />
      </View>
    );
  } else {
    body = (
      <FlatList
        testID="wallet-list"
        data={wallets ?? []}
        keyExtractor={(item) => String((item as WalletInfo).walletId)}
        renderItem={({ item }) => {
          const wallet = item as WalletInfo;
          const icon = walletIconInfo(wallet);
          return (
            <Pressable
              testID={`wallet-row-${String(wallet.walletId)}`}
              accessibilityRole="button"
              accessibilityLabel={`Connect ${wallet.name}`}
              onPress={() => startConnect(wallet)}
              style={({ pressed }: { pressed: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: theme.borderRadius,
                backgroundColor: pressed ? theme.colors.surface : 'transparent',
              })}
            >
              <WalletIcon url={icon.url} format={icon.format} size={36} theme={theme} testID={`icon-${String(wallet.walletId)}`} />
              <Text style={[textStyle, { marginLeft: 12, fontSize: 16 }]}>{wallet.name}</Text>
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <Modal
      testID={testID ?? 'wallet-modal'}
      visible={visible}
      transparent
      // Reduce motion is a vestibular accessibility setting, so drop the slide when it is on.
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* The scrim is a plain View so it fills the screen and carries the overlay colour;
          the keyboard avoider wraps only the sheet, which is what has to move. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View
            style={panel}
            // Traps the screen reader inside the sheet, so the content behind the scrim is
            // not reachable while the sheet is open.
            accessibilityViewIsModal
            accessibilityRole="none"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text
                accessibilityRole="header"
                style={[textStyle, { fontSize: 18, fontWeight: '600' }]}
              >
                Connect a wallet
              </Text>
              <Pressable testID="close" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <CloseIcon color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            {/* Announces a state change (loading, connecting, failure) to a screen reader
                rather than leaving it silent while the visuals change. */}
            <View
              accessibilityLiveRegion="polite"
              accessibilityLabel={liveMessage}
              testID="connect-modal-status"
            >
              {body}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
