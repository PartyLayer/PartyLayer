/**
 * Wallet icon renderer. Always shows the real wallet logo, never initials or a letter.
 *
 * - png and jpg: React Native's `Image` with the URL.
 * - svg: react-native-svg's `SvgUri` (loaded through the guarded loader).
 * - unknown, or a load failure: a neutral wallet glyph built from themed views, so it
 *   renders even without react-native-svg. This path is live today because
 *   walletconnect's icon is currently missing on the CDN.
 */
import { useState } from 'react';
import { View, Image } from 'react-native';
import type { IconFormat } from '../icons';
import type { ReactNativeTheme } from '../theme';
import { getSvgComponents } from './svg-loader';

export interface WalletIconProps {
  url?: string;
  format: IconFormat;
  size: number;
  theme: ReactNativeTheme;
  testID?: string;
}

/** A neutral, letter-free placeholder tile (a minimal wallet card shape). */
function NeutralWalletGlyph({ size, theme, testID }: { size: number; theme: ReactNativeTheme; testID?: string }) {
  return (
    <View
      testID={testID ? `${testID}-fallback` : 'wallet-icon-fallback'}
      style={{
        width: size,
        height: size,
        borderRadius: theme.borderRadius,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.5,
          height: size * 0.34,
          borderRadius: Math.max(2, size * 0.08),
          backgroundColor: theme.colors.textSecondary,
        }}
      />
    </View>
  );
}

export function WalletIcon({ url, format, size, theme, testID }: WalletIconProps) {
  const [errored, setErrored] = useState(false);

  if (errored || !url || format === 'unknown') {
    return <NeutralWalletGlyph size={size} theme={theme} testID={testID} />;
  }

  if (format === 'png' || format === 'jpg') {
    return (
      <Image
        testID={testID}
        source={{ uri: url }}
        onError={() => setErrored(true)}
        style={{ width: size, height: size, borderRadius: theme.borderRadius }}
      />
    );
  }

  // format === 'svg': render through react-native-svg (guarded loader throws a clear
  // error if the optional peer is missing).
  const { SvgUri } = getSvgComponents();
  return <SvgUri testID={testID} uri={url} width={size} height={size} onError={() => setErrored(true)} />;
}
