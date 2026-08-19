/**
 * WalletList: the connect modal, kept as the name this package shipped in 0.2.2.
 *
 * The implementation moved to {@link ConnectModal}, which is the same flow plus the safe
 * area inset, reduced motion and screen reader work. This delegates to it so there is one
 * implementation rather than two that drift, and so an existing caller gets those
 * improvements without changing a line.
 *
 * `ConnectModal` is the name to reach for in new code: it takes the same props and adds
 * `insets`.
 */
import type { PartyLayerClient } from '@partylayer/sdk';
import type { ReactNativeTheme } from '../theme';
import { ConnectModal, type ConnectModalInsets } from './connect-modal';

export interface WalletListProps {
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

export function WalletList(props: WalletListProps) {
  return <ConnectModal {...props} />;
}
