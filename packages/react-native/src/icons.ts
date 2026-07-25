/**
 * Icon data helpers for the component phase (B2). No components here.
 *
 * React Native's `Image` renders PNG and JPG natively but NOT SVG, so B2 needs to pick
 * a renderer per wallet. This derives a format hint from the icon URL's extension so
 * B2 does not re-parse. SVG rendering will require react-native-svg, added in B2.
 *
 * The hint is conservative: an unresolvable or unexpected extension is `unknown`, not
 * assumed to be `svg`. This matters because a registry icon can be missing on the CDN
 * (for example a URL that returns an HTML fallback), so the caller should treat
 * `unknown` as "no native renderer known" rather than guessing.
 */
import type { WalletInfo } from '@partylayer/sdk';

/** The icon format a wallet URL points at, inferred from its extension. */
export type IconFormat = 'svg' | 'png' | 'jpg' | 'unknown';

/** Per-wallet icon data for the component phase. */
export interface WalletIconInfo {
  walletId: string;
  /** The icon URL, or `undefined` when the wallet has none. */
  url?: string;
  /** The format hint derived from the URL extension. */
  format: IconFormat;
}

/**
 * Derive an {@link IconFormat} from a URL by its file extension. `jpeg` maps to `jpg`.
 * A missing URL, or any other extension, is `unknown`.
 */
export function deriveIconFormat(url?: string): IconFormat {
  if (!url) return 'unknown';
  // Drop a query string or fragment, then read the last path extension.
  const path = url.split(/[?#]/, 1)[0];
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return 'unknown';
  const ext = path.slice(lastDot + 1).toLowerCase();
  if (ext === 'svg') return 'svg';
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return 'unknown';
}

/**
 * The icon data for a wallet: its URL (preferring `md`, then `sm`, then `lg`) and the
 * derived format hint.
 */
export function walletIconInfo(wallet: WalletInfo): WalletIconInfo {
  const url = wallet.icons.md ?? wallet.icons.sm ?? wallet.icons.lg;
  return {
    walletId: String(wallet.walletId),
    url,
    format: deriveIconFormat(url),
  };
}
