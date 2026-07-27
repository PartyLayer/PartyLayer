/**
 * Wallet icon renderer. Always shows the real wallet logo, never initials or a letter.
 *
 * - png and jpg: React Native's `Image` with the URL.
 * - svg: the content is fetched and validated as real SVG before rendering through
 *   react-native-svg's `SvgXml`. This is deliberate: `SvgUri` fetches internally but does
 *   not fire `onError` when the response is not SVG (for example a registry URL that
 *   returns an HTML landing page), so it would render nothing with no way to fall back.
 *   Validating the fetched body first lets a bad response fall back to the neutral glyph.
 * - unknown, a load failure, or a response that is not SVG: a neutral wallet glyph built
 *   from themed views, so it renders even without react-native-svg. This path is live
 *   today because walletconnect's icon is currently missing on the CDN.
 */
import { useEffect, useState } from 'react';
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

/** Whether a fetched response body is actually SVG markup (not HTML or anything else). */
function isSvgMarkup(text: string): boolean {
  const body = text.replace(/^\uFEFF/, '').trimStart();
  const head = body.slice(0, 256).toLowerCase();
  if (head.startsWith('<svg')) return true;
  return head.startsWith('<?xml') && body.toLowerCase().includes('<svg');
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
  const [svgXml, setSvgXml] = useState<string | null>(null);

  const wantsSvg = !errored && !!url && format === 'svg';

  useEffect(() => {
    if (!wantsSvg) return;
    let active = true;
    setSvgXml(null);
    (async () => {
      try {
        const res = await fetch(url as string);
        const text = res.ok ? await res.text() : '';
        if (!active) return;
        if (isSvgMarkup(text)) setSvgXml(text);
        else setErrored(true);
      } catch {
        if (active) setErrored(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [wantsSvg, url]);

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

  // format === 'svg': render the validated markup through react-native-svg's SvgXml (the
  // guarded loader throws a clear error if the optional peer is missing).
  const { SvgXml } = getSvgComponents();
  if (!svgXml) {
    // Fetching or validating: a transparent, correctly sized placeholder, never a letter.
    return <View testID={testID} style={{ width: size, height: size }} />;
  }
  return <SvgXml testID={testID} xml={svgXml} width={size} height={size} />;
}
