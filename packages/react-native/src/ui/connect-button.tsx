/**
 * ConnectButton: a Pressable reflecting the connect state.
 *
 * Disconnected shows the label and opens the wallet list on press. Connecting shows a
 * spinner. Connected shows the party identity with the wallet's real logo, and pressing
 * disconnects. Mirrors the web connect button's behavior, not its markup. The pressed
 * state uses `theme.colors.pressed` (the RN-adapted `primaryHover` from B1).
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PartyLayerClient } from '@partylayer/sdk';
import type { ReactNativeTheme } from '../theme';
import { useResolvedTheme } from '../theme-context';
import { useResolvedClient } from '../context';
import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import { WalletIcon } from './wallet-icon';
import { Spinner } from './chrome-icons';
import { WalletList } from './wallet-list';

/** Shorten a party id for display: keep the head and tail. */
export function truncateParty(partyId: string): string {
  if (partyId.length <= 18) return partyId;
  return `${partyId.slice(0, 10)}...${partyId.slice(-6)}`;
}

export interface ConnectButtonProps {
  /** Omit to use the client from `PartyLayerProvider`. */
  client?: PartyLayerClient;
  /** Omit to use the theme from `ThemeProvider`, or the default theme. */
  theme?: ReactNativeTheme;
  /** The disconnected label. Defaults to "Connect Wallet". */
  label?: string;
  testID?: string;
}

export function ConnectButton({
  client: explicitClient,
  theme: explicitTheme,
  label = 'Connect Wallet',
  testID,
}: ConnectButtonProps = {}) {
  const client = useResolvedClient(explicitClient);
  const theme = useResolvedTheme(explicitTheme);
  const { session, status, disconnect } = useConnect(client);
  const { walletIcons } = useWallets(client);
  const [open, setOpen] = useState(false);

  const base = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius,
  };

  let content;
  let onPress: () => void;

  if (session) {
    const icon = walletIcons.find((w) => w.walletId === String(session.walletId));
    onPress = () => {
      void disconnect();
    };
    content = (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <WalletIcon url={icon?.url} format={icon?.format ?? 'unknown'} size={20} theme={theme} testID={`${testID ?? 'connect'}-icon`} />
        <Text style={{ color: theme.colors.primaryForeground, marginLeft: 8, fontFamily: theme.fontFamily }}>
          {truncateParty(String(session.partyId))}
        </Text>
      </View>
    );
  } else if (status === 'connecting') {
    onPress = () => {};
    content = (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Spinner color={theme.colors.primaryForeground ?? theme.colors.text} />
        <Text style={{ color: theme.colors.primaryForeground, marginLeft: 8, fontFamily: theme.fontFamily }}>
          Connecting...
        </Text>
      </View>
    );
  } else {
    onPress = () => setOpen(true);
    content = (
      <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.fontFamily }}>{label}</Text>
    );
  }

  return (
    <View>
      <Pressable
        testID={testID ?? 'connect-button'}
        accessibilityRole="button"
        accessibilityLabel={session ? 'Disconnect wallet' : label}
        onPress={onPress}
        disabled={status === 'connecting'}
        style={({ pressed }: { pressed: boolean }) => ({
          ...base,
          // The pressed color is the RN-adapted hover state from the theme bridge.
          backgroundColor: pressed ? theme.colors.pressed : theme.colors.primary,
        })}
      >
        {content}
      </Pressable>
      <WalletList client={client} theme={theme} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
