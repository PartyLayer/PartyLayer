/**
 * @partylayer/react-native/ui: the connect UI components.
 *
 * Ships `ConnectButton`, `WalletList` (the connect modal, covering the wallet list, the
 * connecting state and the error state), `WalletIcon`, and the chrome icons.
 *
 * This entrypoint renders SVG wallet logos and chrome icons, so it needs
 * react-native-svg (an optional peer of the package). The headless "." entrypoint does
 * NOT import react-native-svg, so a dApp using only the hooks is never forced to
 * install it.
 */
export { ConnectButton, truncateParty } from './ui/connect-button';
export type { ConnectButtonProps } from './ui/connect-button';
export { ConnectModal, useReducedMotion } from './ui/connect-modal';
export type { ConnectModalProps, ConnectModalInsets } from './ui/connect-modal';
export { WalletList } from './ui/wallet-list';
export type { WalletListProps } from './ui/wallet-list';
export { WalletIcon } from './ui/wallet-icon';
export type { WalletIconProps } from './ui/wallet-icon';
export { Spinner, CloseIcon, BackIcon, ErrorIcon } from './ui/chrome-icons';
