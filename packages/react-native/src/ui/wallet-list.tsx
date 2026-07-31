/**
 * WalletList: the connect modal. Core flow only: the wallet list, the connecting state
 * (a spinner plus the wallet being connected, cancellable), and the error state (a
 * message plus retry). On success the modal dismisses; the button reflects the session.
 *
 * No QR view: the web modal has one so a desktop user can scan with a phone, and on a
 * phone there is nothing to scan. Selecting a wallet here calls `client.connect` with
 * that wallet id, and the registered adapter decides how it reaches its wallet. See the
 * README.
 */
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import type { PartyLayerClient } from '@partylayer/sdk';
import type { WalletInfo } from '@partylayer/sdk';
import type { ReactNativeTheme } from '../theme';
import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import { walletIconInfo } from '../icons';
import { WalletIcon } from './wallet-icon';
import { CloseIcon, ErrorIcon, Spinner } from './chrome-icons';

export interface WalletListProps {
  client: PartyLayerClient;
  theme: ReactNativeTheme;
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function WalletList({ client, theme, visible, onClose, testID }: WalletListProps) {
  const { wallets, isLoading, isError, error, refetch } = useWallets(client);
  const { connect } = useConnect(client);
  const [connecting, setConnecting] = useState<WalletInfo | null>(null);
  const [connectError, setConnectError] = useState<Error | null>(null);

  const startConnect = (wallet: WalletInfo) => {
    setConnectError(null);
    setConnecting(wallet);
    connect({ walletId: String(wallet.walletId) } as never)
      .then(() => {
        setConnecting(null);
        onClose(); // Connected: dismiss; the button reflects the session.
      })
      .catch((err: unknown) => {
        // Keep `connecting` set so retry knows which wallet to reopen; the error
        // branch below takes priority over the connecting branch.
        setConnectError(err instanceof Error ? err : new Error(String(err)));
      });
  };

  const panel = {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius,
    padding: 20,
    minHeight: 240,
  };
  const textStyle = { color: theme.colors.text, fontFamily: theme.fontFamily };
  const mutedStyle = { color: theme.colors.textSecondary, fontFamily: theme.fontFamily };

  let body;
  if (connectError) {
    body = (
      <View testID="state-error" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ErrorIcon color={theme.colors.error} />
        <Text style={[textStyle, { marginTop: 12, fontWeight: '600' }]}>Could not connect</Text>
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>{connectError.message}</Text>
        <Pressable
          testID="retry"
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
    body = (
      <View testID="state-connecting" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Spinner color={theme.colors.primary} size="large" />
        <Text style={[textStyle, { marginTop: 16 }]}>Connecting to {connecting.name}</Text>
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>Opening the wallet app...</Text>
        <Pressable testID="cancel" onPress={() => setConnecting(null)} style={{ marginTop: 20, padding: 10 }}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fontFamily }}>Cancel</Text>
        </Pressable>
      </View>
    );
  } else if (isError) {
    body = (
      <View testID="state-list-error" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={[textStyle, { fontWeight: '600' }]}>Could not load wallets</Text>
        <Text style={[mutedStyle, { marginTop: 4, textAlign: 'center' }]}>{error?.message ?? ''}</Text>
        <Pressable testID="reload" onPress={() => refetch()} style={{ marginTop: 20, padding: 10 }}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fontFamily }}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (isLoading) {
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
    <Modal testID={testID ?? 'wallet-modal'} visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
        <View style={panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={[textStyle, { fontSize: 18, fontWeight: '600' }]}>Connect a wallet</Text>
            <Pressable testID="close" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          {body}
        </View>
      </View>
    </Modal>
  );
}
